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
  // "Admin" is the role in the ACTIVE org — someone can be an admin at one org and
  // a plain member at another (issue #3).
  if (!me || me.activeRole !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }

  // Scope to the org the session is acting as (the code they logged in with), so
  // an admin who belongs to several orgs manages the one they're currently in.
  const activeOrg = me.activeOrganization;
  const accreditor = orgCanAccredit(activeOrg?.type);
  // Only SCHOOL admins promote/demote issuers; companies and accreditors do not.
  const canManageRoles = orgCanIssue(activeOrg?.type);
  // The single category this accreditor grants (for the accreditor view's badge).
  const viewerCategory = activeOrg?.accreditationCategory?.trim().toUpperCase() ?? null;

  const where: Prisma.UserWhereInput = accreditor
    ? // Issuing accounts the accreditor can vouch for: issuers/admins whose PRIMARY
      // org is a school, PLUS anyone who is an issuer/admin at a school via a
      // membership (e.g. a worker at a company who issues at a school) — otherwise
      // a membership-issuer could never be accredited and so could never mint (#3).
      {
        OR: [
          { role: { in: ["ISSUER", "ADMIN"] }, organization: { type: "SCHOOL" } },
          { schoolMemberships: { some: { role: { in: ["ISSUER", "ADMIN"] } } } },
        ],
      }
    : // Active-org members, including school-membership enrollees (break-glass
      // admin with no org sees only themselves).
      activeOrg
      ? orgMemberFilter(activeOrg.id)
      : { id: me.id };

  const users = await prisma.user.findMany({
    where,
    include: {
      wallet: true,
      organization: true,
      // The user's membership in the ACTIVE org (if any), so we can read the role
      // they hold here when it isn't their primary org. Empty for the accreditor
      // and company views (no one holds a membership in those org types).
      schoolMemberships: { where: { organizationId: activeOrg?.id ?? "" }, select: { role: true } },
    },
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
    const isPrimaryMember = u.organizationId === activeOrg?.id;
    // The role this user holds IN the active org: their global role when it's their
    // primary org, otherwise the role on their membership here. In the accreditor
    // view they were listed because they issue (globally or via a membership), so
    // surface that as ISSUER/ADMIN regardless of their primary-org role.
    const roleInOrg = accreditor
      ? u.role === "ADMIN"
        ? "ADMIN"
        : "ISSUER"
      : isPrimaryMember
        ? u.role
        : u.schoolMemberships[0]?.role ?? "WORKER";

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
      // The role in the active org — what the admin manages and the UI badges.
      role: roleInOrg,
      address: u.wallet?.address ?? null,
      createdAt: u.createdAt,
      orgName: u.organization?.name ?? null,
      // Whether the active org is this user's PRIMARY org. The PATCH route uses the
      // same test to decide whether a role change updates User.role or the school
      // membership role; the client no longer needs it to gate buttons.
      isPrimaryMember,
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
