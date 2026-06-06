import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { accreditationOf } from "@/lib/chain/registry";
import { canIssue } from "@/lib/roles";
import { orgCanAccredit } from "@/lib/orgTypes";

export const runtime = "nodejs";

/**
 * GET /api/admin/users (admin only).
 *  • School/company admins manage roles within their OWN organization.
 *  • Accreditor admins instead see the issuers across all SCHOOL orgs — the
 *    people they can accredit — each tagged with their org name.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }

  const accreditor = orgCanAccredit(me.organization?.type);

  const where: Prisma.UserWhereInput = accreditor
    ? // Issuing accounts (issuers + school admins) in training-provider orgs.
      { role: { in: ["ISSUER", "ADMIN"] }, organization: { type: "SCHOOL" } }
    : // Own-org members (break-glass admin with no org sees only themselves).
      me.organizationId
      ? { organizationId: me.organizationId }
      : { id: me.id };

  const users = await prisma.user.findMany({
    where,
    include: { wallet: true, organization: true },
    orderBy: { createdAt: "desc" },
  });

  // Accreditation is only meaningful for issuers; resolve it on-chain for those.
  const users2 = await Promise.all(
    users.map(async (u) => {
      const accred =
        canIssue(u.role) && u.wallet?.address
          ? await accreditationOf(u.wallet.address)
          : { accredited: false, accreditorName: null };
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        address: u.wallet?.address ?? null,
        createdAt: u.createdAt,
        orgName: u.organization?.name ?? null,
        accredited: accred.accredited,
        accreditorName: accred.accreditorName,
      };
    })
  );

  return NextResponse.json({ users: users2, viewerIsAccreditor: accreditor });
}
