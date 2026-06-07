import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { orgCanIssue } from "@/lib/orgTypes";
import type { Role } from "@/types/credential";

export const runtime = "nodejs";

const ROLES: Role[] = ["WORKER", "ISSUER", "ADMIN"];

/**
 * PATCH /api/admin/users/:id (admin only)  Body: { role }
 * Sets a user's role IN THE ACTIVE ORG. For a member whose primary org is this
 * school, that's their global User.role; for someone who belongs via a school
 * membership (e.g. a worker at a company who trains here), it's the role on that
 * membership — so a school can make them an issuer here without touching their role
 * at their company (issue #3). Granting ISSUER only updates our DB; the on-chain
 * ISSUER_ROLE is granted lazily by ensureIssuerRole() the first mint.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  // Admin-ness is evaluated in the active org (issue #3).
  if (!me || me.activeRole !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }
  // Acting as the org the session logged into. Only training providers (schools)
  // promote issuers — a company verifies workers, it doesn't mint, so its admins
  // can't grant issuer access (fix #12).
  const activeOrg = me.activeOrganization;
  if (!activeOrg || !orgCanIssue(activeOrg.type)) {
    return NextResponse.json(
      { error: "Only training-provider admins can change issuer roles." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const { role } = (await req.json().catch(() => ({}))) as { role?: string };
  if (!role || !ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "valid role required (WORKER | ISSUER | ADMIN)" }, { status: 400 });
  }

  // Prevent an admin from removing their own admin role (avoids lockout).
  if (id === me.id && role !== "ADMIN") {
    return NextResponse.json({ error: "you cannot change your own admin role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { schoolMemberships: { where: { organizationId: activeOrg.id }, select: { id: true } } },
  });
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (target.organizationId === activeOrg.id) {
    // This school is the target's PRIMARY org → set their global role.
    await prisma.user.update({ where: { id }, data: { role } });
  } else if (target.schoolMemberships.length > 0) {
    // They belong here via a membership → set the role on that membership only,
    // leaving their company role (User.role) untouched.
    await prisma.schoolMembership.updateMany({
      where: { userId: id, organizationId: activeOrg.id },
      data: { role },
    });
  } else {
    // Not a member of the active org. Treat as not found so an admin can't probe
    // or modify users outside their org.
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user: { id, role } });
}
