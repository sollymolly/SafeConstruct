import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { canIssue } from "@/lib/roles";
import { orgCanIssue } from "@/lib/orgTypes";
import { certsForCategories } from "@/lib/certCatalog";

export const runtime = "nodejs";

/**
 * GET /api/issuer/certs — the certifications the signed-in issuer may mint: the
 * catalog entries (src/lib/certCatalog.ts) in the categories they've been
 * accredited for. Drives the searchable dropdown on /issuer. Returns an empty
 * list when the issuer isn't accredited (the issue form then tells them so).
 */
export async function GET() {
  const me = await getCurrentUser();
  // Gate on the role + org the session is acting as, matching the issue flow (#3).
  if (!me || !canIssue(me.activeRole) || !orgCanIssue(me.activeOrganization?.type)) {
    return NextResponse.json({ certs: [], categories: [] });
  }
  const rows = await prisma.accreditation.findMany({
    where: { issuerId: me.id },
    select: { category: true },
  });
  const categories = [...new Set(rows.map((r) => r.category.toUpperCase()))];
  return NextResponse.json({ categories, certs: certsForCategories(categories) });
}
