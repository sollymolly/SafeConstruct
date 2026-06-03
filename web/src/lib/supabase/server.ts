import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Bound to the request cookies so it can read (and, where allowed, refresh) the
 * auth session. Uses the public anon key only — all privileged off-chain data
 * access goes through Prisma, never this client.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where the cookie store is
            // read-only. The middleware refreshes the session on each request,
            // so it is safe to ignore this.
          }
        },
      },
    }
  );
}
