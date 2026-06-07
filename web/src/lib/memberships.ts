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
 * issuer flow (auto-enroll on issue) and the /profile "join a school" action.
 */
export async function ensureSchoolMembership(
  userId: string,
  schoolOrgId: string
): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: schoolOrgId } });
  // orgCanIssue(type) is true only for SCHOOL orgs — our "is a training provider" test.
  if (!org || !orgCanIssue(org.type)) return;
  await prisma.schoolMembership.upsert({
    where: { userId_organizationId: { userId, organizationId: schoolOrgId } },
    create: { userId, organizationId: schoolOrgId },
    update: {},
  });
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
