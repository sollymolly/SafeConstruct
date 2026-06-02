import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser, setCurrentUser, clearCurrentUser } from "@/lib/auth";
import { findOrCreateUser } from "@/lib/users";
import type { Role } from "@/types/credential";

export const runtime = "nodejs"; // uses Prisma + node:crypto

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  wallet: { address: string } | null;
}) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, address: u.wallet?.address ?? null };
}

/** GET /api/auth → the currently signed-in user (or null). */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? publicUser(user) : null });
}

/** POST /api/auth { email, name?, role? } → sign in (creating the user if new). */
export async function POST(req: Request) {
  const { email, name, role } = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: Role;
  };
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  let user = await findOrCreateUser({ email, name, role });

  // For an existing user, let the dev sign-in update name/role on demand.
  if ((role && user.role !== role) || (name && user.name !== name)) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: role ?? user.role, name: name ?? user.name },
      include: { wallet: true },
    });
  }

  await setCurrentUser(user.id);
  return NextResponse.json({ user: publicUser(user) });
}

/** DELETE /api/auth → sign out. */
export async function DELETE() {
  await clearCurrentUser();
  return NextResponse.json({ ok: true });
}
