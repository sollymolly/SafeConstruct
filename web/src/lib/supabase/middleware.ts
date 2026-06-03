import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that require a signed-in user. API routes enforce their own role checks.
const PROTECTED_PREFIXES = ["/issuer", "/worker", "/admin"];

/** Whether real Supabase credentials are present (vs. the .env placeholders). */
function supabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("<") && !key.includes("<"));
}

/**
 * Refreshes the Supabase session cookie on every request (required for SSR auth)
 * and bounces logged-out users off protected pages to /login. Follows the
 * official @supabase/ssr middleware pattern: don't run logic between creating
 * the client and calling getUser(), and always return supabaseResponse so the
 * refreshed cookies are written back.
 */
export async function updateSession(request: NextRequest) {
  // Before Supabase is configured, don't touch auth — let pages render.
  if (!supabaseConfigured()) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/")
  );
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
