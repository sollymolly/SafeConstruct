import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST /auth/signout → clear the Supabase session and return home. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with a GET to the home page.
  return NextResponse.redirect(new URL("/", new URL(request.url).origin), {
    status: 303,
  });
}
