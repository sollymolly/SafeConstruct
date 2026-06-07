import { getAddress, parseEther, type Hex } from "viem";
import { CREDENTIAL_REGISTRY_ABI, CREDENTIAL_REGISTRY_ADDRESS } from "./generated";
import { publicClient, relayerClient, walletClientFor, IS_LOCAL } from "./client";

function registryAddress(): Hex {
  // The address is chain-specific, but generated.ts holds only ONE value — written
  // by whichever `deploy:*` ran last. So an env override takes precedence: set
  // CREDENTIAL_REGISTRY_ADDRESS per environment (e.g. the Base Sepolia address on
  // Vercel) and production is immune to a local `deploy:local` clobbering the file.
  // Falls back to the generated constant for local dev, where deploy:local keeps it
  // in sync automatically.
  const fromEnv = process.env.CREDENTIAL_REGISTRY_ADDRESS?.trim();
  const address = fromEnv || CREDENTIAL_REGISTRY_ADDRESS;
  if (!address) {
    throw new Error(
      "CredentialRegistry address is empty — set CREDENTIAL_REGISTRY_ADDRESS, or deploy: `npm run contracts:deploy:local`."
    );
  }
  return address as Hex;
}

const contract = () =>
  ({ address: registryAddress(), abi: CREDENTIAL_REGISTRY_ABI }) as const;

export type OnChainCredential = {
  dataHash: Hex;
  worker: Hex;
  issuer: Hex;
  issuedAt: bigint;
  expiresAt: bigint;
  revoked: boolean;
  exists: boolean;
  credentialType: string;
};

// ---- reads -----------------------------------------------------------------

export async function getCredential(credentialId: Hex): Promise<OnChainCredential> {
  return publicClient.readContract({
    ...contract(),
    functionName: "getCredential",
    args: [credentialId],
  }) as Promise<OnChainCredential>;
}

export async function isIssuer(addr: Hex): Promise<boolean> {
  return publicClient.readContract({
    ...contract(),
    functionName: "isIssuer",
    args: [getAddress(addr)],
  }) as Promise<boolean>;
}

// ---- accreditation ---------------------------------------------------------
// A standalone ABI fragment so these calls work the moment the (re)deployed
// contract exposes them; against an older deployment the reads simply revert and
// are treated as "not accredited" by accreditationOf.
const ACCREDITATION_ABI = [
  {
    type: "function",
    name: "getAccreditation",
    stateMutability: "view",
    inputs: [{ name: "issuer", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "accreditor", type: "address" },
          { name: "accreditorName", type: "string" },
          { name: "accreditedAt", type: "uint64" },
          { name: "revoked", type: "bool" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "accreditIssuer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "accreditorName", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeAccreditation",
    stateMutability: "nonpayable",
    inputs: [{ name: "issuer", type: "address" }],
    outputs: [],
  },
] as const;

const accredContract = () =>
  ({ address: registryAddress(), abi: ACCREDITATION_ABI }) as const;

export type IssuerAccreditation = { accredited: boolean; accreditorName: string | null };

/** Resolve an issuer's accreditation; never throws (unaccredited on any error). */
export async function accreditationOf(addr: string): Promise<IssuerAccreditation> {
  try {
    const a = (await publicClient.readContract({
      ...accredContract(),
      functionName: "getAccreditation",
      args: [getAddress(addr as Hex)],
    })) as { accreditorName: string; revoked: boolean; exists: boolean };
    if (!a.exists || a.revoked) return { accredited: false, accreditorName: null };
    return { accredited: true, accreditorName: a.accreditorName };
  } catch {
    return { accredited: false, accreditorName: null };
  }
}

/** Relayer (an accreditor) vouches for an issuer under a named body. */
export async function accreditIssuer(issuerAddress: Hex, accreditorName: string): Promise<Hex> {
  const hash = await relayerClient().writeContract({
    ...accredContract(),
    functionName: "accreditIssuer",
    args: [getAddress(issuerAddress), accreditorName],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function revokeAccreditation(issuerAddress: Hex): Promise<Hex> {
  const hash = await relayerClient().writeContract({
    ...accredContract(),
    functionName: "revokeAccreditation",
    args: [getAddress(issuerAddress)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// ---- relayer/admin helpers -------------------------------------------------

/**
 * Poll until `check` passes, to ride out the read-after-write lag of a
 * load-balanced public RPC: a transaction confirmed on one node isn't always
 * instantly visible on the node that serves the next request. Resolves as soon as
 * the state reads back consistently (effectively immediately on a single-node
 * local chain).
 */
async function waitForConsistency(
  check: () => Promise<boolean>,
  tries = 8,
  delayMs = 1500
): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

/** Grant ISSUER_ROLE to an issuer's custodial wallet (idempotent). */
export async function ensureIssuerRole(issuerAddress: Hex): Promise<void> {
  if (await isIssuer(issuerAddress)) return;
  const hash = await relayerClient().writeContract({
    ...contract(),
    functionName: "addIssuer",
    args: [getAddress(issuerAddress)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  // The grant is mined, but the issuer's own issue tx runs moments later and may
  // hit an RPC node that hasn't seen it yet (-> AccessControlUnauthorizedAccount).
  // Wait until the role reads back consistently before returning.
  await waitForConsistency(() => isIssuer(issuerAddress));
}

/**
 * Top up an issuer's custodial wallet from the relayer so it can pay gas for its
 * own issue/revoke transactions. On the local Hardhat chain funds are free, so we
 * keep a generous balance; on a public testnet we top up tiny amounts — testnet
 * gas (especially on an L2 like Base Sepolia) is cheap and faucets are stingy, so
 * a fraction of a cent's worth of ETH covers many transactions. The relayer must
 * therefore hold enough native gas on whichever chain CHAIN_TARGET selects.
 */
export async function ensureGas(addr: Hex): Promise<void> {
  const minBalance = IS_LOCAL ? parseEther("0.05") : parseEther("0.00002");
  const topUp = IS_LOCAL ? parseEther("1") : parseEther("0.0001");
  const balance = await publicClient.getBalance({ address: getAddress(addr) });
  if (balance >= minBalance) return;
  const hash = await relayerClient().sendTransaction({
    to: getAddress(addr),
    value: topUp,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  // Likewise wait until the funded balance is visible before the issuer spends it.
  await waitForConsistency(
    async () => (await publicClient.getBalance({ address: getAddress(addr) })) >= minBalance
  );
}

// ---- writes ----------------------------------------------------------------

export async function issueCredential(params: {
  issuerPrivateKey: Hex;
  credentialId: Hex;
  worker: Hex;
  dataHash: Hex;
  credentialType: string;
  expiresAt: number; // unix seconds, 0 = never
}): Promise<Hex> {
  const hash = await walletClientFor(params.issuerPrivateKey).writeContract({
    ...contract(),
    functionName: "issueCredential",
    args: [
      params.credentialId,
      getAddress(params.worker),
      params.dataHash,
      params.credentialType,
      BigInt(params.expiresAt),
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function revokeCredential(issuerPrivateKey: Hex, credentialId: Hex): Promise<Hex> {
  const hash = await walletClientFor(issuerPrivateKey).writeContract({
    ...contract(),
    functionName: "revokeCredential",
    args: [credentialId],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
