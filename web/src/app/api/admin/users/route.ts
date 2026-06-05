import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/users (admin only) → the users in the admin's OWN organization,
 * for role management. There is one admin per org, and they only see/manage their
 * own org's members.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    // Scope to this admin's org. (A global break-glass admin with no org sees only
    // themselves rather than every org's users.)
    where: me.organizationId ? { organizationId: me.organizationId } : { id: me.id },
    include: { wallet: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      address: u.wallet?.address ?? null,
      createdAt: u.createdAt,
    })),
  });
}
