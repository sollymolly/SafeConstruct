import { cookies } from "next/headers";
import type { Organization } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionUser, type UserWithWallet } from "@/lib/users";
import { roleForOrg } from "@/lib/memberships";

// Authentication is handled by Supabase Auth (email + password, email
// verification, password reset, JWT sessions in httpOnly cookies). This module
// bridges that session to our own User/Wallet/role model in Postgres.

// The org a session is currently "acting as". A person can belong to several orgs
// (their single company plus many training providers); the join code they log in
// with selects which one is active, and the app renders for THAT org (a school →
// issuer tools, a company → worker/verify). Set in /api/auth/verify-org on login
// and /api/auth/organization on a company switch; cleared on sign-out. Reads fall
// back to the user's primary org when the cookie is missing or stale.
export const ACTIVE_ORG_COOKIE = "safeconstruct.activeOrg";

// The signed-in user plus the org the current session is acting as, and the role
// they hold IN that org. Everywhere we gate "what can this person do right now" we
// use activeOrganization / activeRole, not the raw primary org or global role, so
// the login code determines the dashboard — e.g. ISSUER at a school, WORKER at a
// company (see issue #3). `role`/`organization` stay the global/primary values for
// the few places that need them (account identity, company switch).
export type CurrentUser = UserWithWallet & {
  activeOrganization: Organization | null;
  activeRole: string;
};

/**
 * The signed-in app user (with wallet + active org), or null. Reads the Supabase
 * session, resolves/creates the matching Prisma User via provisionUser, then
 * resolves which of the user's orgs is active for this session. Returns the same
 * shape the API routes depend on, with `activeOrganization` added.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  let session: {
    authId: string;
    email: string;
    name?: string;
    joinCode?: string;
  } | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user?.email) {
      session = {
        authId: data.user.id,
        email: data.user.email,
        name: (data.user.user_metadata?.name as string | undefined) ?? undefined,
        // Set at sign-up so a brand-new (or just-confirmed) account can be bound
        // to its org on first provisioning, even before the first interactive login.
        joinCode:
          (data.user.user_metadata?.organizationCode as string | undefined) ?? undefined,
      };
    }
  } catch {
    // Supabase not configured or unreachable → treat as logged out.
    return null;
  }

  if (!session) return null;
  const user = await provisionUser(session);
  const activeOrganization = await resolveActiveOrg(user);
  // The role in effect this session = the user's role in the active org (their
  // global role for their primary org, or the membership role for a school).
  const activeRole = roleForOrg(user, activeOrganization?.id);
  return { ...user, activeOrganization, activeRole };
}

/**
 * Which org this session is acting as: the one named by the active-org cookie IF
 * the user actually belongs to it (their primary org or any school membership),
 * otherwise their primary org. Resolves from data already loaded on the user — no
 * extra query — and never returns an org the user isn't a member of.
 */
async function resolveActiveOrg(user: UserWithWallet): Promise<Organization | null> {
  let activeId: string | undefined;
  try {
    const jar = await cookies();
    activeId = jar.get(ACTIVE_ORG_COOKIE)?.value;
  } catch {
    // cookies() can be unavailable outside a request scope → use the primary org.
  }
  if (activeId) {
    if (user.organization?.id === activeId) return user.organization;
    const membership = (user.schoolMemberships ?? []).find(
      (m) => m.organizationId === activeId
    );
    if (membership) return membership.organization;
  }
  return user.organization;
}
