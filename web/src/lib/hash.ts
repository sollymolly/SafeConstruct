import { keccak256, toHex, type Hex } from "viem";
import type { CredentialRecord } from "@/types/credential";

/**
 * Deterministic serialization of a credential record. Fields are emitted in a
 * FIXED order (not object-key order) and addresses are lowercased, so the same
 * logical credential always produces the same bytes — and therefore the same
 * hash — on both the issuing and verifying paths. This array IS the preimage
 * committed on-chain.
 */
function canonicalize(record: CredentialRecord): string {
  return JSON.stringify([
    record.credentialId,
    record.workerAddress.toLowerCase(),
    record.issuerAddress.toLowerCase(),
    record.issuerOrg,
    record.credentialType,
    record.title,
    record.description,
    String(record.issuedAt),
    String(record.expiresAt),
  ]);
}

/** keccak256 of the canonical record — the bytes32 stored on-chain as dataHash. */
export function hashCredential(record: CredentialRecord): Hex {
  return keccak256(toHex(canonicalize(record)));
}

/**
 * The DB UUID is the credential's identity; on-chain we key by its keccak256 so
 * the id is a fixed-size bytes32. Same uuid -> same on-chain id, always.
 */
export function toCredentialId(uuid: string): Hex {
  return keccak256(toHex(uuid));
}
