import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { canIssue } from "@/lib/roles";
import { decryptPrivateKey } from "@/lib/wallet/custodial";
import { revokeCredential } from "@/lib/chain/registry";
import { toCredentialId } from "@/lib/hash";

export const runtime = "nodejs";

/** DELETE /api/credentials/:id (issuer only) → revoke a credential on-chain. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const issuer = await getCurrentUser();
  // Gate on the role in the ACTIVE org, matching the issue flow: a user who issues
  // at a school (but is a worker at their company) can revoke only while logged
  // into the school (issue #3). The issuerId check below still ties it to them.
  if (!issuer || !canIssue(issuer.activeRole) || !issuer.wallet) {
    return NextResponse.json({ error: "must be signed in as an issuer" }, { status: 403 });
  }

  const { id } = await params;
  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) return NextResponse.json({ error: "credential not found" }, { status: 404 });
  if (cred.issuerId !== issuer.id) {
    return NextResponse.json({ error: "only the issuing org can revoke" }, { status: 403 });
  }

  const issuerKey = decryptPrivateKey(issuer.wallet);
  const txHash = await revokeCredential(issuerKey, toCredentialId(id) as Hex);
  await prisma.credential.update({ where: { id }, data: { revokedAt: new Date() } });

  return NextResponse.json({ ok: true, txHash });
}
