import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { decodeProof } from "@/lib/proof";
import { hashCredential, toCredentialId } from "@/lib/hash";
import { getCredential, accreditationOf } from "@/lib/chain/registry";
import { recoverCredentialSigner } from "@/lib/chain/eip712";
import type { VerificationStatus } from "@/types/credential";

export const runtime = "nodejs";

/**
 * PUBLIC verification — no auth, no database. Everything is derived from the
 * signed payload supplied in the request (i.e. the QR) and re-checked against
 * the public blockchain: re-hash the record, compare to the on-chain anchor,
 * recover the issuer's signature, and check revocation/expiry. The operator's
 * DB is never consulted, so anyone can verify a credential independently.
 */
export async function POST(req: Request) {
  const { d } = (await req.json().catch(() => ({}))) as { d?: string };
  if (typeof d !== "string") {
    return NextResponse.json({ error: "missing proof" }, { status: 400 });
  }

  let record;
  let signature: string | null;
  try {
    const payload = decodeProof(d);
    record = payload.record;
    signature = payload.signature;
  } catch {
    return NextResponse.json({ error: "invalid proof payload" }, { status: 400 });
  }
  if (!record?.credentialId) {
    return NextResponse.json({ error: "invalid proof payload" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const expectedHash = hashCredential(record);

  let onChain;
  try {
    onChain = await getCredential(toCredentialId(record.credentialId));
  } catch {
    return NextResponse.json(
      { error: "Could not reach the credential chain to verify this proof." },
      { status: 502 }
    );
  }

  let status: VerificationStatus;
  if (!onChain.exists) status = "NOT_FOUND";
  else if (onChain.dataHash.toLowerCase() !== expectedHash.toLowerCase()) status = "TAMPERED";
  else if (onChain.revoked) status = "REVOKED";
  else if (record.expiresAt !== 0 && now > record.expiresAt) status = "EXPIRED";
  else status = "VERIFIED";

  // The signature is only "valid" if it was made by the issuer's wallet AND that
  // same address is the issuer recorded on-chain — closing impersonation.
  let signer: string | null = null;
  let signatureValid = false;
  if (signature) {
    try {
      signer = await recoverCredentialSigner(record, signature as Hex);
      signatureValid =
        signer.toLowerCase() === record.issuerAddress.toLowerCase() &&
        onChain.issuer.toLowerCase() === record.issuerAddress.toLowerCase();
    } catch {
      signer = null;
      signatureValid = false;
    }
  }

  const accred = await accreditationOf(record.issuerAddress);

  return NextResponse.json({
    status,
    record,
    expectedHash,
    onChain: {
      exists: onChain.exists,
      dataHash: onChain.dataHash,
      revoked: onChain.revoked,
      issuer: onChain.issuer,
      worker: onChain.worker,
    },
    signature: signature ?? null,
    signer,
    signatureValid,
    accredited: accred.accredited,
    accreditorName: accred.accreditorName,
  });
}
