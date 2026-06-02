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

/** Grant ISSUER_ROLE to an issuer's custodial wallet (idempotent). */
export async function ensureIssuerRole(issuerAddress: Hex): Promise<void> {
  if (await isIssuer(issuerAddress)) return;
  const hash = await relayerClient().writeContract({
    ...contract(),
    functionName: "addIssuer",
    args: [getAddress(issuerAddress)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

/**
 * On a local chain, top up an issuer wallet from the relayer so it can pay gas.
 * On a real testnet, issuer wallets must be funded out of band (faucet), so we
 * no-op here.
 */
export async function ensureGas(addr: Hex): Promise<void> {
  if (!IS_LOCAL) return;
  const balance = await publicClient.getBalance({ address: getAddress(addr) });
  if (balance > parseEther("0.05")) return;
  const hash = await relayerClient().sendTransaction({
    to: getAddress(addr),
    value: parseEther("1"),
  });
  await publicClient.waitForTransactionReceipt({ hash });
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
