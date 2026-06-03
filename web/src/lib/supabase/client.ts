import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components — used only by the auth forms
 * (sign up / log in / sign out). Reads the browser-safe anon key.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
