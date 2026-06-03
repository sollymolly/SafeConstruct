import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/admin/users (admin only) → all users, for role management. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
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
