export type Role = "WORKER" | "ISSUER" | "ADMIN";

/**
 * The EXACT canonical shape that gets hashed and committed on-chain.
 * Changing this shape (or field order in hash.ts) changes every hash, so treat
 * it as a stable schema. `description` is always a string ("" when absent) so
 * the hash is deterministic.
 */
export type CredentialRecord = {
  credentialId: string; // the off-chain UUID (DB id)
  workerAddress: string;
  issuerAddress: string;
  issuerOrg: string;
  credentialType: string;
  title: string;
  description: string;
  issuedAt: number; // unix seconds
  expiresAt: number; // unix seconds; 0 = never
};

export type VerificationStatus =
  | "VERIFIED" // exists, hash matches, not revoked, not expired
  | "REVOKED"
  | "EXPIRED"
  | "TAMPERED" // off-chain record no longer matches the on-chain hash
  | "NOT_FOUND"; // no record for this id on-chain

export type CredentialVerification = {
  credentialId: string;
  title: string;
  credentialType: string;
  issuerOrg: string;
  issuedAt: number;
  expiresAt: number;
  status: VerificationStatus;
};
