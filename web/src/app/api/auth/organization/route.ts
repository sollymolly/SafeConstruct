import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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
  // belong to. ensureSchoolMembership no-ops when the current org isn't a school
  // (e.g. moving between companies), so this is safe to call unconditionally.
  if (me.organizationId) {
    await ensureSchoolMembership(me.id, me.organizationId);
  }

  await migrateUserToOrg(me.id, me.email, org);
  return NextResponse.json({ ok: true, organization: { id: org.id, name: org.name } });
}
