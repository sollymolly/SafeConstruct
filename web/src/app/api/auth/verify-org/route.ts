import { NextResponse } from "next/server";
import { ACTIVE_ORG_COOKIE, getCurrentUser } from "@/lib/auth";
import { resolveOrgByJoinCode } from "@/lib/orgs";
import { bindUserToOrg } from "@/lib/users";
import { userBelongsToOrg } from "@/lib/memberships";

export const runtime = "nodejs"; // uses Prisma + Supabase server client

// Mark `orgId` as the org this session is acting as. The login code decides which
// of the user's orgs is active, so the dashboard matches it (issue #3).
function okWithActiveOrg(orgId: string) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/**
 * POST /api/auth/verify-org  Body: { code }
 * Called by the log-in page right after Supabase authenticates the password.
 * Enforces organization scoping: the code must match the account's org, otherwise
 * the client signs the session back out. An email is bound to exactly one org, so
 * an org-1 account simply cannot log in against org-2.
 *
 * Switching organizations is deliberately NOT done here — that's the explicit
 * self-service action on /profile (see POST /api/auth/organization).
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const org = await resolveOrgByJoinCode(code);
  if (!org) {
    return NextResponse.json(
      { ok: false, error: "Unknown organization code." },
      { status: 400 }
    );
  }

  // Already bound: the entered code must be for an org this account belongs to —
  // its primary org OR any school it's a member of (a worker can train at several
  // schools, so any of their codes lets them in). Still strict otherwise: no
  // accidental cross-org access, and no silent migration at login.
  if (me.organizationId) {
    if (!userBelongsToOrg(me, org.id)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account isn't part of that organization. Check your code, or switch organizations from your profile.",
        },
        { status: 403 }
      );
    }
    return okWithActiveOrg(org.id);
  }

  // Legacy/shadow account with no org yet → bind it on this first sign-in,
  // preserving any role it already had.
  await bindUserToOrg(me.id, me.email, org, me.role);
  return okWithActiveOrg(org.id);
}
