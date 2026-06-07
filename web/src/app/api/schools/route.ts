import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveOrgByJoinCode } from "@/lib/orgs";
import { orgCanIssue } from "@/lib/orgTypes";
import {
  ensureSchoolMembership,
  removeSchoolMembership,
  userBelongsToOrg,
} from "@/lib/memberships";

export const runtime = "nodejs"; // uses Prisma + Supabase server client

/**
 * POST /api/schools  Body: { code }
 * Join a training provider (school) by its code. A worker can belong to MANY
 * schools — each one may then issue credentials to them. The code must resolve to
 * a SCHOOL-type org; company/accreditor codes are rejected here (your single
 * company is the primary org, changed from the Organization section on /profile).
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const org = await resolveOrgByJoinCode(code);
  if (!org) {
    return NextResponse.json(
      { error: "Unknown organization code. Ask the school's admin for the right one." },
      { status: 400 }
    );
  }
  // orgCanIssue(type) is true only for SCHOOLs — the kind of org you can "join".
  if (!orgCanIssue(org.type)) {
    return NextResponse.json(
      { error: `${org.name} isn't a training provider. Only schools can be joined here.` },
      { status: 400 }
    );
  }
  if (userBelongsToOrg(me, org.id)) {
    return NextResponse.json({ error: `You're already part of ${org.name}.` }, { status: 400 });
  }

  await ensureSchoolMembership(me.id, org.id);
  return NextResponse.json({ ok: true, school: { id: org.id, name: org.name } });
}

/**
 * DELETE /api/schools  Body: { organizationId }
 * Leave a school you joined. Not usable on your primary org — that's the "switch
 * organization" action on /profile.
 */
export async function DELETE(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { organizationId } = (await req.json().catch(() => ({}))) as {
    organizationId?: string;
  };
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }
  if (organizationId === me.organizationId) {
    return NextResponse.json(
      { error: "That's your primary organization — change it from the Organization section." },
      { status: 400 }
    );
  }

  await removeSchoolMembership(me.id, organizationId);
  return NextResponse.json({ ok: true });
}
