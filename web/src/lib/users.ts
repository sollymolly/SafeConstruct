import type { Organization, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { createWallet } from "@/lib/wallet/custodial";
import { isOrgAdminEmail, resolveOrgByJoinCode } from "@/lib/orgs";
import type { Role } from "@/types/credential";

// Every user is returned with their wallet AND their organization, since callers
// (the /api/auth payload, role checks, admin scoping) need both.
export type UserWithWallet = Prisma.UserGetPayload<{
  include: { wallet: true; organization: true };
}>;

const withRelations = { wallet: true, organization: true } as const;

/** Prisma raises P2002 when a unique constraint (here authId/email) is violated. */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002"
  );
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether this email should be an ADMIN: either a global break-glass admin
 * (ADMIN_EMAILS env) or the configured admin of its organization. Roles are
 * per-org, so org membership decides admin-ship for everyone else.
 */
function isAdminEmail(email: string, org: Pick<Organization, "adminEmail"> | null): boolean {
  return adminEmails().includes(email.trim().toLowerCase()) || isOrgAdminEmail(org, email);
}

function newWalletData() {
  const w = createWallet();
  return {
    address: w.address,
    encryptedPrivateKey: w.encryptedPrivateKey,
    iv: w.iv,
    authTag: w.authTag,
  };
}

export async function provisionUser(params: {
  authId: string;
  email: string;
  name?: string;
  // The org join code carried in the Supabase user_metadata from sign-up. Used
  // only to BIND an org the first time (create, claim-shadow, or legacy backfill);
  // it never moves an already-bound user (that's the explicit /profile switch).
  joinCode?: string | null;
}): Promise<UserWithWallet> {
  const email = params.email.trim().toLowerCase();
  const org = await resolveOrgByJoinCode(params.joinCode);

  const linked = await prisma.user.findUnique({
    where: { authId: params.authId },
    include: withRelations,
  });
  if (linked) {
    // Backfill an org for legacy accounts (created before orgs existed) on their
    // first sign-in with a valid code; also (re)assert ADMIN for an org admin.
    const effectiveOrg = linked.organization ?? org;
    const shouldBeAdmin = isAdminEmail(email, effectiveOrg);
    const needsOrgBackfill = !linked.organizationId && org !== null;
    if (needsOrgBackfill || (shouldBeAdmin && linked.role !== "ADMIN")) {
      return prisma.user.update({
        where: { id: linked.id },
        data: {
          organizationId: needsOrgBackfill ? org!.id : undefined,
          role: shouldBeAdmin ? "ADMIN" : undefined,
        },
        include: withRelations,
      });
    }
    return linked;
  }

  const shadow = await prisma.user.findUnique({
    where: { email },
    include: withRelations,
  });
  if (shadow) {
    // A worker issued to before signing up. Claim the row; keep the org the issuer
    // already placed them in (the on-chain credentials belong to that org).
    const effectiveOrg = shadow.organization ?? org;
    return prisma.user.update({
      where: { id: shadow.id },
      data: {
        authId: params.authId,
        name: params.name?.trim() || shadow.name,
        organizationId: shadow.organizationId ?? org?.id,
        role: isAdminEmail(email, effectiveOrg) ? "ADMIN" : shadow.role,
        wallet: shadow.wallet ? undefined : { create: newWalletData() },
      },
      include: withRelations,
    });
  }

  // Brand-new account: a valid organization join code is required to create one.
  // (Our sign-up form validates the code before calling supabase.auth.signUp, so
  // this only trips if the org was removed between sign-up and first sign-in.)
  if (!org) {
    throw new Error("A valid organization join code is required to create an account.");
  }
  const role: Role = isAdminEmail(email, org) ? "ADMIN" : "WORKER";
  try {
    return await prisma.user.create({
      data: {
        authId: params.authId,
        email,
        name: params.name?.trim() || email.split("@")[0],
        role,
        organizationId: org.id,
        wallet: { create: newWalletData() },
      },
      include: withRelations,
    });
  } catch (e) {
    // The first page load after sign-up fires several concurrent /api/auth calls
    // (the navbar, the destination page, and React StrictMode's double-invoke in
    // dev), so two requests can race to create the same brand-new user. The loser
    // hits a unique-constraint error (P2002) — recover by returning the row the
    // winner just created instead of letting it escape as a 500.
    if (isUniqueViolation(e)) {
      const created = await prisma.user.findFirst({
        where: { OR: [{ authId: params.authId }, { email }] },
        include: withRelations,
      });
      if (created) return created;
    }
    throw e;
  }
}

/**
 * Bind a not-yet-assigned user (legacy or shadow) to an org without disturbing
 * their existing role — used by /api/auth/verify-org when an old account signs in
 * for the first time after orgs were introduced. Upgrades to ADMIN if applicable
 * but never downgrades a previously granted ISSUER/ADMIN.
 */
export async function bindUserToOrg(
  userId: string,
  email: string,
  org: Organization,
  currentRole: string
): Promise<UserWithWallet> {
  const role = isAdminEmail(email, org) ? "ADMIN" : currentRole;
  return prisma.user.update({
    where: { id: userId },
    data: { organizationId: org.id, role },
    include: withRelations,
  });
}

/**
 * Move a user to a different org (the self-service switch on /profile). Roles are
 * per-org, so arriving in the new org they're its ADMIN (if its configured
 * adminEmail) or a plain WORKER — any ISSUER/ADMIN from the old org is dropped.
 * Credentials are keyed on User.id, so they travel with the account.
 */
export async function migrateUserToOrg(
  userId: string,
  email: string,
  org: Organization
): Promise<UserWithWallet> {
  const role: Role = isAdminEmail(email, org) ? "ADMIN" : "WORKER";
  return prisma.user.update({
    where: { id: userId },
    data: { organizationId: org.id, role },
    include: withRelations,
  });
}

export async function findOrCreateUser(params: {
  email: string;
  name?: string;
  // The issuing party's org — a worker issued to before signing up is placed in
  // the issuer's organization so their credentials and membership line up.
  organizationId?: string | null;
}): Promise<UserWithWallet> {
  const email = params.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    include: withRelations,
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email,
      name: params.name?.trim() || email.split("@")[0],
      role: "WORKER",
      organizationId: params.organizationId ?? null,
      wallet: { create: newWalletData() },
    },
    include: withRelations,
  });
}
