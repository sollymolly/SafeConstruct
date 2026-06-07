import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { canIssue } from "@/lib/roles";
import { orgCanAccredit, orgCanIssue } from "@/lib/orgTypes";
import { accreditIssuer, revokeAccreditation } from "@/lib/chain/registry";

export const runtime = "nodejs";

/**
 * POST /api/admin/accredit — vouch for (or revoke) a school issuer's
 * accreditation. Only ACCREDITOR-type orgs may do this; the target must be an
 * issuing account in a training-provider (SCHOOL) org.
 *
 * Each accreditor grants exactly ONE credential CATEGORY — its configured
 * Organization.accreditationCategory (e.g. our sample accreditor → "OSHA"). The
 * grant is recorded two ways: on-chain (CredentialRegistry, for the cryptographic
 * trust proof verifiers see) and off-chain in the Accreditation table (which
 * category, so the issue flow can gate on it). Body: { userId, revoke? }.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }
  if (!orgCanAccredit(me.organization?.type)) {
    return NextResponse.json(
      { error: "Only accreditation bodies can accredit issuers." },
      { status: 403 }
    );
  }

  // The single category this accreditor grants. Seeded on the org
  // (prisma/organizations.json → accreditationCategory). Without it there's
  // nothing to accredit FOR.
  const category = me.organization?.accreditationCategory?.trim().toUpperCase();
  if (!category) {
    return NextResponse.json(
      { error: "Your accreditation body has no configured certification category to grant." },
      { status: 400 }
    );
  }
  const accreditorName = me.organization?.name ?? "Accreditation Body";

  const { userId, revoke } = (await req.json().catch(() => ({}))) as {
    userId?: string;
    revoke?: boolean;
  };
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true, organization: true },
  });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // You accredit issuers at training providers (schools), not arbitrary accounts.
  if (!orgCanIssue(user.organization?.type) || !canIssue(user.role)) {
    return NextResponse.json(
      { error: "Only issuers at a training provider can be accredited." },
      { status: 400 }
    );
  }
  if (!user.wallet?.address) {
    return NextResponse.json({ error: "user has no wallet" }, { status: 400 });
  }

  try {
    if (revoke) {
      await revokeAccreditation(user.wallet.address as Hex);
      await prisma.accreditation.deleteMany({ where: { issuerId: user.id, category } });
      return NextResponse.json({ ok: true, accredited: false, category, accreditorName: null });
    }

    await accreditIssuer(user.wallet.address as Hex, accreditorName);
    // Record WHICH category off-chain so the issue flow can gate on it. Idempotent
    // on (issuerId, category) — re-accrediting just refreshes the body name.
    await prisma.accreditation.upsert({
      where: { issuerId_category: { issuerId: user.id, category } },
      create: {
        issuerId: user.id,
        category,
        accreditorName,
        accreditorOrgId: me.organizationId ?? null,
      },
      update: { accreditorName, accreditorOrgId: me.organizationId ?? null },
    });
    return NextResponse.json({ ok: true, accredited: true, category, accreditorName });
  } catch (err) {
    console.error("Accreditation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "On-chain accreditation failed" },
      { status: 500 }
    );
  }
}
