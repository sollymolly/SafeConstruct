import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveOrgByJoinCode } from "@/lib/orgs";
import { migrateUserToOrg } from "@/lib/users";

export const runtime = "nodejs"; // uses Prisma + Supabase server client

/**
 * POST /api/auth/organization  Body: { code }
 * The self-service "switch organization" action from /profile. Moves the signed-in
 * user to the organization for `code`. Their credentials travel with them (they're
 * keyed on User.id); their role is re-evaluated in the new org (ADMIN only if its
 * configured adminEmail, otherwise WORKER).
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const org = await resolveOrgByJoinCode(code);
  if (!org) {
    return NextResponse.json(
      { error: "Unknown organization code. Ask that company's admin for the right one." },
      { status: 400 }
    );
  }

  if (me.organizationId === org.id) {
    return NextResponse.json(
      { error: `You're already part of ${org.name}.` },
      { status: 400 }
    );
  }

  await migrateUserToOrg(me.id, me.email, org);
  return NextResponse.json({ ok: true, organization: { id: org.id, name: org.name } });
}
