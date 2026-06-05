import { getAddress, parseEther, type Hex } from "viem";
import { CREDENTIAL_REGISTRY_ABI, CREDENTIAL_REGISTRY_ADDRESS } from "./generated";
import { publicClient, relayerClient, walletClientFor, IS_LOCAL } from "./client";

function registryAddress(): Hex {
  if (!CREDENTIAL_REGISTRY_ADDRESS) {
    throw new Error(
      "CredentialRegistry address is empty — deploy the contract first: `npm run contracts:deploy:local`."
    );
  }
  return CREDENTIAL_REGISTRY_ADDRESS as Hex;
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
