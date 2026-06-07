import { NextResponse } from "next/server";
import { ACTIVE_ORG_COOKIE, getCurrentUser } from "@/lib/auth";
import { resolveOrgByJoinCode } from "@/lib/orgs";
import { migrateUserToOrg } from "@/lib/users";
import { ensureSchoolMembership } from "@/lib/memberships";
import { orgCanVerify } from "@/lib/orgTypes";

export const runtime = "nodejs"; // uses Prisma + Supabase server client

/**
 * POST /api/auth/organization  Body: { code }
 * The self-service "company" action from /profile. A worker's PRIMARY org is their
 * single employer company, so this endpoint only accepts COMPANY codes: it lets a
 * worker join their first company, or switch from one company to another. Joining a
 * school is a separate, additive action (POST /api/schools). Credentials travel
 * with the account (keyed on User.id); the role is re-evaluated in the new company
 * (ADMIN only if its configured adminEmail, otherwise WORKER).
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const org = await resolveOrgByJoinCode(code);
  if (!org) {
    return NextResponse.json(
      { error: "Unknown company code. Ask that company's admin for the right one." },
      { status: 400 }
    );
  }

  // A school is NOT a company. This slot is the worker's single employer, so only
  // COMPANY codes are valid here — schools are joined from the Training Providers
  // section instead.
  if (!orgCanVerify(org.type)) {
    return NextResponse.json(
      {
        error: `${org.name} isn't a company. You can only join or switch to a construction company here — join a school from Training Providers.`,
      },
      { status: 400 }
    );
  }

  if (me.organizationId === org.id) {
    return NextResponse.json(
      { error: `You're already part of ${org.name}.` },
      { status: 400 }
    );
  }

  // If their current primary org is a SCHOOL, keep it as a school membership
  // before moving — changing companies shouldn't drop a training provider they
  // belong to, NOR the role they held there. Carry their current role onto the
  // membership so an ISSUER at that school stays an issuer there after the switch
  // (their global role still resets to WORKER for the new company). No-ops when
  // the current org isn't a school, so it's safe to call unconditionally.
  if (me.organizationId) {
    await ensureSchoolMembership(me.id, me.organizationId, me.role);
  }

  await migrateUserToOrg(me.id, me.email, org);
  // The new company becomes the session's active org, so the dashboard switches to
  // it immediately (rather than lingering on the previous org's context).
  const res = NextResponse.json({
    ok: true,
    organization: { id: org.id, name: org.name },
  });
  res.cookies.set(ACTIVE_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
