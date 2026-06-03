import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SERVICE ROLE key. Bypasses Row-Level
 * Security and unlocks the Admin API (auth.admin.*) — used here to change a
 * user's login email server-side and confirm it immediately. NEVER import this
 * into a Client Component or otherwise expose the service-role key to the browser.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
