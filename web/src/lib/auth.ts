import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/users";

// Authentication is handled by Supabase Auth (email + password, email
// verification, password reset, JWT sessions in httpOnly cookies). This module
// bridges that session to our own User/Wallet/role model in Postgres.

/**
 * The signed-in app user (with wallet), or null. Reads the Supabase session,
 * then resolves/creates the matching Prisma User via provisionUser. Returns the
 * same shape the API routes depend on: { id, email, name, role, wallet, ... }.
 */
export async function getCurrentUser() {
  let session: {
    authId: string;
    email: string;
    name?: string;
    joinCode?: string;
  } | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user?.email) {
      session = {
        authId: data.user.id,
        email: data.user.email,
        name: (data.user.user_metadata?.name as string | undefined) ?? undefined,
        // Set at sign-up so a brand-new (or just-confirmed) account can be bound
        // to its org on first provisioning, even before the first interactive login.
        joinCode:
          (data.user.user_metadata?.organizationCode as string | undefined) ?? undefined,
      };
    }
  } catch {
    // Supabase not configured or unreachable → treat as logged out.
    return null;
  }

  if (!session) return null;
  return provisionUser(session);
}
