import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";

const COOKIE = "sc_uid";

// NOTE: This is a DEV-ONLY session — a plaintext userId in a cookie, no password.
// It exists so the three role flows (issuer/worker/verifier) are demoable.
// Replace with real authentication (e.g. Auth.js) before any real deployment.

export async function getCurrentUser() {
  const store = await cookies();
  const uid = store.get(COOKIE)?.value;
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid }, include: { wallet: true } });
}

export async function setCurrentUser(userId: string) {
  const store = await cookies();
  store.set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearCurrentUser() {
  const store = await cookies();
  store.delete(COOKIE);
}
