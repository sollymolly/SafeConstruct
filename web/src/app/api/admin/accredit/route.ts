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
 * accreditation on-chain. Only ACCREDITOR-type orgs may do this; the target must
 * be an issuing account in a training-provider (SCHOOL) org. The platform relayer
 * records the named accrediting body so verifiers can trust WHO issued.
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

  const { userId, accreditorName, revoke } = (await req.json().catch(() => ({}))) as {
    userId?: string;
    accreditorName?: string;
    revoke?: boolean;
  };
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (!revoke && !accreditorName?.trim()) {
    return NextResponse.json({ error: "accreditorName is required" }, { status: 400 });
  }

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
      return NextResponse.json({ ok: true, accredited: false, accreditorName: null });
    }
    await accreditIssuer(user.wallet.address as Hex, accreditorName!.trim());
    return NextResponse.json({ ok: true, accredited: true, accreditorName: accreditorName!.trim() });
  } catch (err) {
    console.error("Accreditation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "On-chain accreditation failed" },
      { status: 500 }
    );
  }
}
