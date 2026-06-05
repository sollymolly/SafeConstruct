import type { Organization } from "@prisma/client";
import { prisma } from "@/lib/db/client";

// Organizations (construction companies) are first-class DB rows (see the
// Organization model in prisma/schema.prisma). They're seeded by the platform
// owner via `npm run db:seed` (prisma/seed.mjs); a platform super-admin UI can
// manage them at runtime later. Each User is bound to one org via
// User.organizationId, and people join an org by typing its `joinCode`.

/** Join codes are matched case-insensitively and stored UPPER-cased, trimmed. */
export function normalizeJoinCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/** The organization for a join code, or null if the code is unknown/blank. */
export async function resolveOrgByJoinCode(
  code: string | null | undefined
): Promise<Organization | null> {
  const joinCode = normalizeJoinCode(code);
  if (!joinCode) return null;
  return prisma.organization.findUnique({ where: { joinCode } });
}

/** Whether `email` is the configured admin for `org` (case-insensitive). */
export function isOrgAdminEmail(
  org: Pick<Organization, "adminEmail"> | null,
  email: string
): boolean {
  if (!org?.adminEmail) return false;
  return org.adminEmail.trim().toLowerCase() === email.trim().toLowerCase();
}
