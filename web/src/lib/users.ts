import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { createWallet } from "@/lib/wallet/custodial";
import type { Role } from "@/types/credential";

export type UserWithWallet = Prisma.UserGetPayload<{ include: { wallet: true } }>;

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
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
}): Promise<UserWithWallet> {
  const email = params.email.trim().toLowerCase();
  const bootstrapAdmin = adminEmails().includes(email);

  const linked = await prisma.user.findUnique({
    where: { authId: params.authId },
    include: { wallet: true },
  });
  if (linked) {
    if (bootstrapAdmin && linked.role !== "ADMIN") {
      return prisma.user.update({
        where: { id: linked.id },
        data: { role: "ADMIN" },
        include: { wallet: true },
      });
    }
    return linked;
  }

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
        role: bootstrapAdmin ? "ADMIN" : shadow.role,
        wallet: shadow.wallet ? undefined : { create: newWalletData() },
      },
      include: { wallet: true },
    });
  }

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

export async function findOrCreateUser(params: {
  email: string;
  name?: string;
}): Promise<UserWithWallet> {
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