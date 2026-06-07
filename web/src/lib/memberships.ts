import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { orgCanIssue } from "@/lib/orgTypes";

// School memberships are the additive half of org membership: a user has ONE
// primary org (User.organizationId — a worker's single company) plus MANY school
// affiliations recorded here, so several training providers can each issue
// credentials to the same worker. See the SchoolMembership model in
// prisma/schema.prisma and the note in src/lib/orgTypes.ts.

/**
 * Record that `userId` belongs to the SCHOOL `schoolOrgId`. Idempotent — the
 * @@unique([userId, organizationId]) makes re-enrolling a no-op. Defensive: does
 * nothing for a non-SCHOOL org, so a company can never land in this table (the
 * only company link a user has is their single User.organizationId). Used by the
 * /profile "join a school" action and to preserve a school-primary's role when a
 * worker switches companies.
 *
 * `role` is the per-org role to carry onto the membership. New rows default to
 * WORKER (a trainee joining a school); pass a role only to PRESERVE one (e.g. a
 * user whose primary school becomes a membership on a company switch keeps the
 * role they held there). Omitting it leaves an existing row's role untouched.
 */
export async function ensureSchoolMembership(
  userId: string,
  schoolOrgId: string,
  role?: string
): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: schoolOrgId } });
  // orgCanIssue(type) is true only for SCHOOL orgs — our "is a training provider" test.
  if (!org || !orgCanIssue(org.type)) return;
  await prisma.schoolMembership.upsert({
    where: { userId_organizationId: { userId, organizationId: schoolOrgId } },
    create: { userId, organizationId: schoolOrgId, role: role ?? "WORKER" },
    update: role ? { role } : {},
  });
}

/**
 * The user's effective role in org `orgId`: their global User.role when that's
 * their primary org, otherwise the role recorded on their school membership.
 * Falls back to the global role when no membership is found (or no org given).
 * This is what the active-org login resolves a session's acting role from.
 */
export function roleForOrg(
  user: {
    role: string;
    organizationId: string | null;
    schoolMemberships?: { organizationId: string; role: string }[];
  },
  orgId: string | null | undefined
): string {
  if (!orgId || user.organizationId === orgId) return user.role;
  const membership = (user.schoolMemberships ?? []).find((m) => m.organizationId === orgId);
  return membership ? membership.role : user.role;
}

/** Drop a worker's affiliation with a school (the /profile "leave" action). */
export async function removeSchoolMembership(
  userId: string,
  schoolOrgId: string
): Promise<void> {
  // deleteMany (not delete) so a missing row is a no-op rather than a throw.
  await prisma.schoolMembership.deleteMany({
    where: { userId, organizationId: schoolOrgId },
  });
}

/**
 * Whether `user` belongs to org `orgId` — as their primary org OR via a school
 * membership. Lets login accept a join code for ANY org the user is part of, not
 * just their primary one (see api/auth/verify-org).
 */
export function userBelongsToOrg(
  user: { organizationId: string | null; schoolMemberships?: { organizationId: string }[] },
  orgId: string
): boolean {
  if (user.organizationId === orgId) return true;
  return (user.schoolMemberships ?? []).some((m) => m.organizationId === orgId);
}

/**
 * Prisma `where` matching users who belong to org `orgId` — primary-org members
 * OR workers enrolled via a school membership. For a COMPANY this collapses to
 * just `organizationId` (nobody holds a company membership), so it is safe to use
 * for any org type. Used by admin/analytics scoping so a school "sees" the
 * workers it has trained, not only those whose primary org is the school.
 */
export function orgMemberFilter(orgId: string): Prisma.UserWhereInput {
  return {
    OR: [
      { organizationId: orgId },
      { schoolMemberships: { some: { organizationId: orgId } } },
    ],
  };
}
