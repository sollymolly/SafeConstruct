import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs"; // uses Prisma + Supabase server client

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  wallet: { address: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    address: u.wallet?.address ?? null,
  };
}

/**
 * GET /api/auth → the currently signed-in user (or null).
 * Sign-up / log-in / sign-out are handled by Supabase Auth directly (see the
 * /signup, /login pages and the /auth/* routes), so this endpoint is read-only.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? publicUser(user) : null });
}
