import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { canIssue } from "@/lib/roles";
import { findOrCreateUser } from "@/lib/users";
import { decryptPrivateKey } from "@/lib/wallet/custodial";
import { hashCredential, toCredentialId } from "@/lib/hash";
import { ensureGas, ensureIssuerRole, issueCredential } from "@/lib/chain/registry";
import type { CredentialRecord } from "@/types/credential";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const workerEmail = new URL(req.url).searchParams.get("workerEmail")?.toLowerCase();
  const me = await getCurrentUser();
  const email = workerEmail ?? me?.email;
  if (!email) return NextResponse.json({ error: "no worker specified" }, { status: 400 });

  const worker = await prisma.user.findUnique({ where: { email } });
  if (!worker) return NextResponse.json({ credentials: [] });

  const creds = await prisma.credential.findMany({
    where: { workerId: worker.id },
    include: { issuer: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    credentials: creds.map((c) => ({
      id: c.id,
      credentialType: c.credentialType,
      title: c.title,
      description: c.description,
      issuerOrg: c.issuer.name,
      issuedAt: Math.floor(c.issuedAt.getTime() / 1000),
      expiresAt: c.expiresAt ? Math.floor(c.expiresAt.getTime() / 1000) : 0,
      txHash: c.txHash,
      revokedAt: c.revokedAt,
    })),
  });
}

export async function POST(req: Request) {
  const issuer = await getCurrentUser();
  if (!issuer || !canIssue(issuer.role)) {
    return NextResponse.json({ error: "must be signed in as an issuer" }, { status: 403 });
  }
  if (!issuer.wallet) {
    return NextResponse.json({ error: "issuer has no wallet" }, { status: 500 });
  }

  const { workerEmail, credentialType, title, description, expiresAt } = (await req
    .json()
    .catch(() => ({}))) as {
    workerEmail?: string;
    credentialType?: string;
    title?: string;
    description?: string;
    expiresAt?: string | number | null;
  };

  if (!workerEmail || !credentialType || !title) {
    return NextResponse.json(
      { error: "workerEmail, credentialType and title are required" },
      { status: 400 }
    );
  }

  // Issue within your own organization: a worker created here is placed in the
  // issuer's org, and an existing worker who belongs to a different org is refused.
  const worker = await findOrCreateUser({
    email: workerEmail,
    organizationId: issuer.organizationId,
  });
  // An issuer/admin must not issue a credential to themselves — a credential is an
  // attestation about *another* person, so self-issuance is never legitimate.
  if (worker.id === issuer.id) {
    return NextResponse.json(
      { error: "You can't issue a credential to yourself." },
      { status: 400 }
    );
  }
  if (!worker.wallet) {
    return NextResponse.json({ error: "worker has no wallet" }, { status: 500 });
  }
  if (
    issuer.organizationId &&
    worker.organizationId &&
    worker.organizationId !== issuer.organizationId
  ) {
    return NextResponse.json(
      { error: "That worker is not a part of your organization." },
      { status: 403 }
    );
  }

  const id = randomUUID();
  const credentialId = toCredentialId(id);
  const issuedAtSec = Math.floor(Date.now() / 1000);
  const expiresAtSec = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : 0;

  const record: CredentialRecord = {
    credentialId: id,
    workerAddress: worker.wallet.address,
    issuerAddress: issuer.wallet.address,
    issuerOrg: issuer.name,
    credentialType,
    title,
    description: description ?? "",
    issuedAt: issuedAtSec,
    expiresAt: expiresAtSec,
  };
  const dataHash = hashCredential(record);

  // Wrap all blockchain operations — any RPC/gas/contract error returns
  // a proper JSON error instead of crashing with an empty 500 response.
  try {
    const issuerKey = decryptPrivateKey(issuer.wallet);
    await ensureGas(issuer.wallet.address as Hex);
    await ensureIssuerRole(issuer.wallet.address as Hex);

    const txHash = await issueCredential({
      issuerPrivateKey: issuerKey,
      credentialId,
      worker: worker.wallet.address as Hex,
      dataHash,
      credentialType,
      expiresAt: expiresAtSec,
    });

    const saved = await prisma.credential.create({
      data: {
        id,
        workerId: worker.id,
        issuerId: issuer.id,
        credentialType,
        title,
        description: description ?? null,
        issuedAt: new Date(issuedAtSec * 1000),
        expiresAt: expiresAtSec ? new Date(expiresAtSec * 1000) : null,
        dataHash,
        txHash,
      },
    });

    return NextResponse.json(
      { credential: { id: saved.id, txHash, dataHash } },
      { status: 201 }
    );
  } catch (err) {
    console.error("Credential mint error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Blockchain transaction failed" },
      { status: 500 }
    );
  }
}