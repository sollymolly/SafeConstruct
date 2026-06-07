import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { orgCanAccredit, orgCanIssue } from "@/lib/orgTypes";
import { orgMemberFilter } from "@/lib/memberships";

export const runtime = "nodejs";

/**
 * GET /api/admin/users (admin only).
 *  • School admins manage roles within their OWN org. The list now includes
 *    workers enrolled via a school membership (not just primary-org members), so a
 *    worker who joins the school from their profile shows up here too (fix #4).
 *  • Company admins see their workforce but cannot manage issuer roles — issuing
 *    is the school's job (fix #12); the client hides the role buttons.
 *  • Accreditor admins instead see the issuers across all SCHOOL orgs — the people
 *    they can accredit — tagged with their org name and accreditation status.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }

  const accreditor = orgCanAccredit(me.organization?.type);
  // Only SCHOOL admins promote/demote issuers; companies and accreditors do not.
  const canManageRoles = orgCanIssue(me.organization?.type);
  // The single category this accreditor grants (for the accreditor view's badge).
  const viewerCategory = me.organization?.accreditationCategory?.trim().toUpperCase() ?? null;

  const where: Prisma.UserWhereInput = accreditor
    ? // Issuing accounts (issuers + school admins) in training-provider orgs.
      { role: { in: ["ISSUER", "ADMIN"] }, organization: { type: "SCHOOL" } }
    : // Own-org members, including school-membership enrollees (break-glass admin
      // with no org sees only themselves).
      me.organizationId
      ? orgMemberFilter(me.organizationId)
      : { id: me.id };

  const users = await prisma.user.findMany({
    where,
    include: { wallet: true, organization: true },
    orderBy: { createdAt: "desc" },
  });

  // Resolve off-chain accreditation for the listed users in one query, then map.
  const accreditations = await prisma.accreditation.findMany({
    where: { issuerId: { in: users.map((u) => u.id) } },
    select: { issuerId: true, category: true, accreditorName: true },
  });
  const byUser = new Map<string, { category: string; accreditorName: string }[]>();
  for (const a of accreditations) {
    const arr = byUser.get(a.issuerId) ?? [];
    arr.push({ category: a.category, accreditorName: a.accreditorName });
    byUser.set(a.issuerId, arr);
  }

  const users2 = users.map((u) => {
    const rows = byUser.get(u.id) ?? [];
    let accredited = false;
    let accreditorName: string | null = null;
    let category: string | null = null;
    if (accreditor) {
      // Whether THIS accreditor has cleared them for its own category.
      const hit = rows.find((r) => r.category.toUpperCase() === viewerCategory);
      accredited = Boolean(hit);
      accreditorName = hit?.accreditorName ?? null;
      category = viewerCategory;
    } else {
      accredited = rows.length > 0;
      accreditorName = rows[0]?.accreditorName ?? null;
      category = rows.length ? [...new Set(rows.map((r) => r.category))].join(", ") : null;
    }
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      address: u.wallet?.address ?? null,
      createdAt: u.createdAt,
      orgName: u.organization?.name ?? null,
      // True only for users whose PRIMARY org is the viewer's org. Role actions are
      // limited to these (a school-membership-only worker is trained here but staffed
      // elsewhere, so their role is managed by their own org).
      isPrimaryMember: u.organizationId === me.organizationId,
      accredited,
      accreditorName,
      category,
    };
  });

  return NextResponse.json({
    users: users2,
    viewerIsAccreditor: accreditor,
    viewerCanManageRoles: canManageRoles,
    viewerCategory,
  });
}
