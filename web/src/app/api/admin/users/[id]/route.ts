import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types/credential";

export const runtime = "nodejs";

const ROLES: Role[] = ["WORKER", "ISSUER", "ADMIN"];

/**
 * PATCH /api/admin/users/:id (admin only)  Body: { role }
 * Sets a user's role. Granting ISSUER only updates our DB; the on-chain
 * ISSUER_ROLE is granted lazily by ensureIssuerRole() the first time that
 * issuer mints a credential.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }

  const { id } = await params;
  const { role } = (await req.json().catch(() => ({}))) as { role?: string };
  if (!role || !ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "valid role required (WORKER | ISSUER | ADMIN)" }, { status: 400 });
  }

  // Prevent an admin from removing their own admin role (avoids lockout).
  if (id === me.id && role !== "ADMIN") {
    return NextResponse.json({ error: "you cannot change your own admin role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const updated = await prisma.user.update({ where: { id }, data: { role } });
  return NextResponse.json({ ok: true, user: { id: updated.id, role: updated.role } });
}
