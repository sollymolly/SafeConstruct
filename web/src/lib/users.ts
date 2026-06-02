import { prisma } from "@/lib/db/client";
import { createWallet } from "@/lib/wallet/custodial";
import type { Role } from "@/types/credential";

/**
 * Find a user by email, or create them with a fresh custodial wallet. Used both
 * at sign-in and when an issuer issues to a worker who isn't in the system yet.
 * Does NOT change an existing user's role (the auth route handles that).
 */
export async function findOrCreateUser(params: { email: string; name?: string; role?: Role }) {
  const email = params.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email }, include: { wallet: true } });
  if (existing) return existing;

  const wallet = createWallet();
  return prisma.user.create({
    data: {
      email,
      name: params.name?.trim() || email.split("@")[0],
      role: params.role ?? "WORKER",
      wallet: {
        create: {
          address: wallet.address,
          encryptedPrivateKey: wallet.encryptedPrivateKey,
          iv: wallet.iv,
          authTag: wallet.authTag,
        },
      },
    },
    include: { wallet: true },
  });
}
