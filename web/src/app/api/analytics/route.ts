import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { orgHasAnalytics } from "@/lib/orgTypes";
import {
  credentialInclude,
  credentialScope,
  resolveStatuses,
  isCompromised,
  type CredentialWithParties,
} from "@/lib/credentials";

export const runtime = "nodejs";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

const TYPE_COLORS = ["var(--brand)", "var(--ok)", "var(--warn)", "#8b5cf6", "#38bdf8", "var(--bad)"];

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  // Gate and scope on the org the session is acting as, so this matches what the
  // navbar shows for the active login (issue #3).
  const activeOrg = me.activeOrganization;
  if (!orgHasAnalytics(activeOrg?.type)) {
    return NextResponse.json({ error: "not available for this organization type" }, { status: 403 });
  }

  const where = credentialScope({ id: me.id, role: me.activeRole, organizationId: activeOrg?.id ?? null });

  const creds = (await prisma.credential.findMany({
    where,
    include: credentialInclude,
    orderBy: { createdAt: "desc" },
  })) as CredentialWithParties[];

  const statuses = await resolveStatuses(creds);
  const onChainCount = [...statuses.values()].filter((s) => s.onChain).length;
  const now = Math.floor(Date.now() / 1000);

  let valid = 0;
  let expiringSoon = 0;
  let compromised = 0;
  let expired = 0;

  const typeMap = new Map<string, { total: number; valid: number }>();
  const workerIds = new Set<string>();
  const issuerIds = new Set<string>();

  for (const c of creds) {
    workerIds.add(c.workerId);
    issuerIds.add(c.issuerId);

    const status = statuses.get(c.id)?.status ?? "NOT_FOUND";
    const exp = c.expiresAt ? Math.floor(c.expiresAt.getTime() / 1000) : 0;

    if (status === "VERIFIED") {
      valid += 1;
      if (exp !== 0 && exp - now <= THIRTY_DAYS) expiringSoon += 1;
    } else if (status === "EXPIRED") {
      expired += 1;
    } else if (isCompromised(status)) {
      compromised += 1;
    }

    const t = typeMap.get(c.credentialType) ?? { total: 0, valid: 0 };
    t.total += 1;
    if (status === "VERIFIED") t.valid += 1;
    typeMap.set(c.credentialType, t);
  }

  const maxType = Math.max(1, ...[...typeMap.values()].map((t) => t.total));
  const distribution = [...typeMap.entries()]
    .map(([type, t], i) => ({
      type,
      total: t.total,
      valid: t.valid,
      width: `${Math.round((t.total / maxType) * 100)}%`,
      color: TYPE_COLORS[i % TYPE_COLORS.length],
    }))
    .sort((a, b) => b.total - a.total);

  const activity = creds.slice(0, 8).map((c) => {
    const status = statuses.get(c.id)?.status ?? "NOT_FOUND";
    const action = c.revokedAt
      ? "REVOKE"
      : isCompromised(status)
        ? "ALERT"
        : "MINT";
    return {
      action,
      status,
      title: c.title,
      credentialType: c.credentialType,
      issuerOrg: c.issuer.name,
      workerName: c.worker.name,
      txHash: c.txHash,
      at: (c.revokedAt ?? c.createdAt).toISOString(),
    };
  });

  const total = creds.length;
  const complianceRate = total === 0 ? 0 : Math.round((valid / total) * 100);

  return NextResponse.json({
    role: me.activeRole,
    name: me.name,
    metrics: {
      total,
      valid,
      expiringSoon,
      expired,
      compromised,
      complianceRate,
      workers: workerIds.size,
      issuers: issuerIds.size,
    },
    distribution,
    activity,
    onChain: { verified: onChainCount, total },
  });
}
