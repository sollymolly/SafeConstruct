import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("sc_uid");
  // Drop the active-org selection so the next login starts from its own code.
  cookieStore.delete(ACTIVE_ORG_COOKIE);
  return NextResponse.json({ success: true });
}