import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { hashCredential, toCredentialId } from "@/lib/hash";
import { getCredential } from "@/lib/chain/registry";
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

      return {
        credentialId: c.id,
        title: c.title,
        credentialType: c.credentialType,
        issuerOrg: c.issuer.name,
        issuedAt,
        expiresAt,
        status,
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
