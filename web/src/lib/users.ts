import { prisma } from "@/lib/db/client";
import { createWallet } from "@/lib/wallet/custodial";
import type { Role } from "@/types/credential";

/** Emails auto-promoted to ADMIN on first sign-in (the bootstrap mechanism). */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Fresh custodial wallet, shaped for a Prisma nested `wallet: { create }`. */
function newWalletData() {
  const w = createWallet();
  return {
    address: w.address,
    encryptedPrivateKey: w.encryptedPrivateKey,
    iv: w.iv,
    authTag: w.authTag,
  };
}

/**
 * Resolve the app User for an authenticated Supabase user, creating or claiming
 * the row as needed. Called on every authenticated request via getCurrentUser().
 *
 *   1. Already linked (authId matches) → return it.
 *   2. A "shadow" row exists for this email (created when an issuer issued to a
 *      worker who had not signed up yet) → claim it: set authId, backfill name,
 *      ensure a wallet.
 *   3. Otherwise create a fresh User + custodial wallet.
 *
 * Role is decided by the SERVER only: ADMIN if the email is in ADMIN_EMAILS,
 * otherwise WORKER. Sign-up can never request a privileged role; ISSUER is
 * granted later by an admin.
 */
export async function provisionUser(params: {
  authId: string;
  email: string;
  name?: string;
}) {
  const email = params.email.trim().toLowerCase();
  const bootstrapAdmin = adminEmails().includes(email);

  // 1. Already linked.
  const linked = await prisma.user.findUnique({
    where: { authId: params.authId },
    include: { wallet: true },
  });
  if (linked) {
    // Keep a bootstrap admin promoted even if the row predates ADMIN_EMAILS.
    if (bootstrapAdmin && linked.role !== "ADMIN") {
      return prisma.user.update({
        where: { id: linked.id },
        data: { role: "ADMIN" },
        include: { wallet: true },
      });
    }
    return linked;
  }

  // 2. Claim a shadow row created during a prior issuance.
  const shadow = await prisma.user.findUnique({
    where: { email },
    include: { wallet: true },
  });
  if (shadow) {
    return prisma.user.update({
      where: { id: shadow.id },
      data: {
        authId: params.authId,
        name: params.name?.trim() || shadow.name,
        // Promote a bootstrap admin; otherwise keep the existing role.
        role: bootstrapAdmin ? "ADMIN" : shadow.role,
        // Backfill a wallet only if the shadow row somehow lacks one.
        wallet: shadow.wallet ? undefined : { create: newWalletData() },
      },
      include: { wallet: true },
    });
  }

  // 3. Brand-new account.
  const role: Role = bootstrapAdmin ? "ADMIN" : "WORKER";
  return prisma.user.create({
    data: {
      authId: params.authId,
      email,
      name: params.name?.trim() || email.split("@")[0],
      role,
      wallet: { create: newWalletData() },
    },
    include: { wallet: true },
  });
}

/**
 * Find a worker by email, or create a "shadow" profile (no auth account yet)
 * with a fresh custodial wallet. Used when an issuer issues a credential to a
 * worker who has not signed up. Always WORKER — never trusts a caller-supplied
 * role. The worker later claims this row on first sign-in (see provisionUser).
 */
export async function findOrCreateUser(params: { email: string; name?: string }) {
  const email = params.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { wallet: true },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email,
      name: params.name?.trim() || email.split("@")[0],
      role: "WORKER",
      wallet: { create: newWalletData() },
    },
    include: { wallet: true },
  });
}
