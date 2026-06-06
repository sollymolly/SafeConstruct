import { getAddress, recoverTypedDataAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN } from "./client";
import { CREDENTIAL_REGISTRY_ADDRESS } from "./generated";
import type { CredentialRecord } from "@/types/credential";

// EIP-712 typed-data signing of a credential. This is a REAL cryptographic
// attestation: the issuer's wallet signs the exact credential content, and
// anyone holding the record + signature can recover the signer's address WITHOUT
// the private key — the basis of independent, tamper-evident verification.
const DOMAIN = {
  name: "SafeConstruct",
  version: "1",
  chainId: CHAIN.id,
  verifyingContract: CREDENTIAL_REGISTRY_ADDRESS as Hex,
} as const;

const TYPES = {
  Credential: [
    { name: "credentialId", type: "string" },
    { name: "worker", type: "address" },
    { name: "issuer", type: "address" },
    { name: "issuerOrg", type: "string" },
    { name: "credentialType", type: "string" },
    { name: "title", type: "string" },
    { name: "description", type: "string" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

function message(record: CredentialRecord) {
  return {
    credentialId: record.credentialId,
    worker: getAddress(record.workerAddress),
    issuer: getAddress(record.issuerAddress),
    issuerOrg: record.issuerOrg,
    credentialType: record.credentialType,
    title: record.title,
    description: record.description,
    issuedAt: BigInt(record.issuedAt),
    expiresAt: BigInt(record.expiresAt),
  };
}

export function credentialTypedData(record: CredentialRecord) {
  return {
    domain: DOMAIN,
    types: TYPES,
    primaryType: "Credential" as const,
    message: message(record),
  };
}

/** The issuer signs the credential at issuance time. */
export async function signCredential(privateKey: Hex, record: CredentialRecord): Promise<Hex> {
  return privateKeyToAccount(privateKey).signTypedData(credentialTypedData(record));
}

/** Recover the address that produced a signature over this exact record. */
export async function recoverCredentialSigner(
  record: CredentialRecord,
  signature: Hex
): Promise<Hex> {
  return recoverTypedDataAddress({ ...credentialTypedData(record), signature });
}
