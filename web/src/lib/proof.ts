import type { CredentialRecord } from "@/types/credential";

// A self-contained, shareable proof: the full credential record plus the
// issuer's EIP-712 signature. Everything a third party needs to verify against
// the public chain WITHOUT the operator's database. Encoded into the QR / URL.
export type ProofPayload = {
  record: CredentialRecord;
  signature: string | null;
};

// URL-safe base64 that works in both the browser (btoa/atob) and Node (Buffer).
function toBase64Url(s: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(s, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof Buffer !== "undefined"
    ? Buffer.from(b64, "base64").toString("utf8")
    : decodeURIComponent(escape(atob(b64)));
}

export function encodeProof(payload: ProofPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeProof(encoded: string): ProofPayload {
  return JSON.parse(fromBase64Url(encoded)) as ProofPayload;
}
