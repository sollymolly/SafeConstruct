import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { hashCredential, toCredentialId } from "@/lib/hash";
import { getCredential, accreditationOf } from "@/lib/chain/registry";
import { recoverCredentialSigner } from "@/lib/chain/eip712";
import { encodeProof } from "@/lib/proof";
import type { Hex } from "viem";
import type {
  CredentialRecord,
  CredentialVerification,
  VerificationStatus,
} from "@/types/credential";

export const runtime = "nodejs";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * POST /api/verify { workerEmail }
 * For each of the worker's credentials, re-derive the hash from the off-chain
 * record and compare it to what's on-chain, then resolve a status. This is the
 * heart of tamper-proof verification: the DB content must still match the chain.
 */
export async function POST(req: Request) {
  const workerEmail = ((await req.json().catch(() => ({}))) as { workerEmail?: string })
    .workerEmail?.toLowerCase();
  if (!workerEmail) return NextResponse.json({ error: "workerEmail is required" }, { status: 400 });

  const worker = await prisma.user.findUnique({
    where: { email: workerEmail },
    include: {
      wallet: true,
      receivedCredentials: { include: { issuer: { include: { wallet: true } } } },
    },
  });

  if (!worker || !worker.wallet) {
    return NextResponse.json({ worker: null, results: [] });
  }

  const now = Math.floor(Date.now() / 1000);

  let results: CredentialVerification[];
  try {
    results = await Promise.all(
    worker.receivedCredentials.map(async (c) => {
      const issuedAt = Math.floor(c.issuedAt.getTime() / 1000);
      const expiresAt = c.expiresAt ? Math.floor(c.expiresAt.getTime() / 1000) : 0;

      const record: CredentialRecord = {
        credentialId: c.id,
        workerAddress: worker.wallet!.address,
        issuerAddress: c.issuer.wallet?.address ?? ZERO,
        issuerOrg: c.issuer.name,
        credentialType: c.credentialType,
        title: c.title,
        description: c.description ?? "",
        issuedAt,
        expiresAt,
      };
      const expectedHash = hashCredential(record);
      const onChain = await getCredential(toCredentialId(c.id));

      let status: VerificationStatus;
      if (!onChain.exists) status = "NOT_FOUND";
      else if (onChain.dataHash.toLowerCase() !== expectedHash.toLowerCase()) status = "TAMPERED";
      else if (onChain.revoked) status = "REVOKED";
      else if (expiresAt !== 0 && now > expiresAt) status = "EXPIRED";
      else status = "VERIFIED";

      // Recover the EIP-712 signer and confirm it is the issuer's wallet.
      const issuerAddress = c.issuer.wallet?.address ?? ZERO;
      let signer: string | null = null;
      let signatureValid = false;
      if (c.signature) {
        try {
          signer = await recoverCredentialSigner(record, c.signature as Hex);
          signatureValid = signer.toLowerCase() === issuerAddress.toLowerCase();
        } catch {
          signer = null;
          signatureValid = false;
        }
      }

      const accred = await accreditationOf(issuerAddress);

      return {
        credentialId: c.id,
        title: c.title,
        credentialType: c.credentialType,
        issuerOrg: c.issuer.name,
        issuedAt,
        expiresAt,
        status,
        dataHash: expectedHash,
        issuerAddress,
        signature: c.signature ?? null,
        signer,
        signatureValid,
        proof: encodeProof({ record, signature: c.signature ?? null }),
        accredited: accred.accredited,
        accreditorName: accred.accreditorName,
      };
    })
    );
  } catch (err) {
    console.error("POST /api/verify: on-chain read failed", err);
    return NextResponse.json(
      {
        error:
          "Could not reach the credential chain. Make sure the local node is running and the contract is deployed (npm run contracts:deploy:local).",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    worker: { name: worker.name, email: worker.email, address: worker.wallet.address },
    results,
  });
}
