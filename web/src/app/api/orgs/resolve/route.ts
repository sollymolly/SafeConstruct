import { NextResponse } from "next/server";
import { resolveOrgByJoinCode } from "@/lib/orgs";

export const runtime = "nodejs"; // uses Prisma

/**
 * POST /api/orgs/resolve  Body: { code }
 * Public: looks up an organization by its join code so the sign-up form can
 * validate the code and show which company the user is joining. Only reveals the
 * org's display name, and only to someone who already knows the code.
 */
export async function POST(req: Request) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const org = await resolveOrgByJoinCode(code);
  if (!org) {
    return NextResponse.json(
      { error: "Unknown organization code. Ask your admin for the right one." },
      { status: 404 }
    );
  }
  return NextResponse.json({ id: org.id, name: org.name });
}
