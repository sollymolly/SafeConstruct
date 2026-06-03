import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs"; // uses Prisma + Supabase server client

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/**
 * PATCH /api/auth → change the signed-in user's login email. Body: { email }.
 *
 * The account's data (credentials, wallet) is keyed to the user's id, not the
 * email, so it stays attached — this simply moves the account onto the new
 * address. The Supabase Auth login is updated via the Admin API with
 * email_confirm, so the change is immediate and the OLD email can no longer be
 * used to sign in. Name and role are NOT editable here (roles go through the
 * admin route).
 */
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!me.authId) {
    return NextResponse.json({ error: "this account has no login to update" }, { status: 400 });
  }

  const { email: raw } = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (raw ?? "").trim().toLowerCase();
  if (email.length < 5 || email.length > 80 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email between 5 and 80 characters is required." },
      { status: 400 }
    );
  }

  // No change → nothing to do.
  if (email === me.email) return NextResponse.json({ user: publicUser(me) });

  // The new address must not already belong to another account (this also
  // guards the Prisma unique constraint on User.email below).
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken && taken.id !== me.id) {
    return NextResponse.json(
      { error: "That email is already in use by another account." },
      { status: 409 }
    );
  }

  // Move the Supabase Auth login to the new email and confirm it immediately, so
  // the old email is severed and can no longer sign in. Do this before touching
  // our DB: if it fails, nothing has changed yet.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(me.authId, {
    email,
    email_confirm: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Relabel our row with the new email. Credentials and the wallet reference the
  // user's id, so they travel with the account automatically.
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { email },
    include: { wallet: true },
  });

  return NextResponse.json({ user: publicUser(updated) });
}
