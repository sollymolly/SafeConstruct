import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { canIssue } from "@/lib/roles";
import { orgCanIssue } from "@/lib/orgTypes";
import { userBelongsToOrg } from "@/lib/memberships";
import { categoryForCode } from "@/lib/certCatalog";
import { decryptPrivateKey } from "@/lib/wallet/custodial";
import { hashCredential, toCredentialId } from "@/lib/hash";
import { ensureGas, ensureIssuerRole, issueCredential } from "@/lib/chain/registry";
import { signCredential } from "@/lib/chain/eip712";
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
  // canIssue is checked against the role in the ACTIVE org: a user who is an
  // issuer at a school but a worker at their company may only mint while logged
  // into the school (issue #3).
  if (!issuer || !canIssue(issuer.activeRole)) {
    return NextResponse.json({ error: "must be signed in as an issuer" }, { status: 403 });
  }
  // Issuance is on behalf of the org the session is acting as (the code they
  // logged in with), not necessarily their primary org — so someone who is an
  // issuer at a school but a worker at their company issues as the school only
  // when logged in there (issue #3).
  const issuingOrg = issuer.activeOrganization;
  // Only training-school orgs may mint; construction companies verify, they
  // don't issue. Enforced here so the rule holds regardless of the UI.
  if (!orgCanIssue(issuingOrg?.type)) {
    return NextResponse.json(
      { error: "Only training providers (schools) can issue credentials." },
      { status: 403 }
    );
  }
  if (!issuer.wallet) {
    return NextResponse.json({ error: "issuer has no wallet" }, { status: 500 });
  }
  // A concrete school is required to check the worker's membership against.
  if (!issuingOrg) {
    return NextResponse.json(
      { error: "Your account isn't attached to a training provider." },
      { status: 403 }
    );
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

  // Accreditation gate: an issuer may only mint credentials in a CATEGORY a
  // recognized accreditor has cleared them for. Block entirely if they have no
  // accreditation, and block any credentialType outside their accredited
  // categories. (The /issuer form only offers accredited certs; this enforces it
  // server-side regardless of the client.)
  const accreditations = await prisma.accreditation.findMany({
    where: { issuerId: issuer.id },
    select: { category: true },
  });
  if (accreditations.length === 0) {
    return NextResponse.json(
      {
        error:
          "You aren't accredited yet. An accreditation body must accredit you before you can issue credentials.",
      },
      { status: 403 }
    );
  }
  const accreditedCategories = new Set(accreditations.map((a) => a.category.toUpperCase()));
  const category = categoryForCode(credentialType);
  if (!category || !accreditedCategories.has(category.toUpperCase())) {
    return NextResponse.json(
      {
        error: `You're not accredited to issue "${credentialType}". Your accreditation covers: ${[...accreditedCategories].join(", ")}.`,
      },
      { status: 403 }
    );
  }

  // A school can only issue to a worker who has already joined it: the worker's
  // email must belong to this training provider first (they sign up with the
  // school's code, or join it from /profile). So we look the worker up rather than
  // creating them, and refuse if they're missing or not a member.
  const worker = await prisma.user.findUnique({
    where: { email: workerEmail.trim().toLowerCase() },
    include: { wallet: true, schoolMemberships: true },
  });
  if (!worker) {
    return NextResponse.json(
      {
        error:
          "No worker account for that email yet. Ask them to sign up and join your training provider with your code, then issue.",
      },
      { status: 404 }
    );
  }
  // An issuer/admin must not issue a credential to themselves — a credential is an
  // attestation about *another* person, so self-issuance is never legitimate.
  if (worker.id === issuer.id) {
    return NextResponse.json(
      { error: "You can't issue a credential to yourself." },
      { status: 400 }
    );
  }
  // Membership precondition: the worker must be part of the issuing school
  // (their primary org or a school membership) before any credential is minted.
  if (!userBelongsToOrg(worker, issuingOrg.id)) {
    return NextResponse.json(
      {
        error:
          "That worker isn't a member of your training provider. Ask them to join with your code first.",
      },
      { status: 403 }
    );
  }
  if (!worker.wallet) {
    return NextResponse.json({ error: "worker has no wallet" }, { status: 500 });
  }

  // Issue #1: an issuer can't hand the same certification to the same worker
  // twice. Block when an ACTIVE (non-revoked, unexpired) credential of this type
  // from this issuer already exists. A revoked one (restoring) or an expired one
  // (renewing) is NOT a duplicate, so re-issuing those is allowed.
  const duplicate = await prisma.credential.findFirst({
    where: {
      workerId: worker.id,
      issuerId: issuer.id,
      credentialType,
      revokedAt: null,
    },
  });
  if (duplicate && (!duplicate.expiresAt || duplicate.expiresAt.getTime() > Date.now())) {
    return NextResponse.json(
      {
        error: `This worker already holds an active "${title}" credential from you. Revoke it first to replace it, or wait until it expires to renew.`,
      },
      { status: 409 }
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

    // The issuer's wallet signs the credential (EIP-712). Stored alongside the
    // record so any verifier can recover the signer without the private key.
    const signature = await signCredential(issuerKey, record);

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
        signature,
      },
    });

    return NextResponse.json(
      { credential: { id: saved.id, txHash, dataHash, signature } },
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