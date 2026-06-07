import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth";
import { orgHasAnalytics } from "@/lib/orgTypes";
import { orgMemberFilter } from "@/lib/memberships";
import {
  credentialInclude,
  credentialScope,
  resolveStatuses,
  isCompromised,
  type CredentialWithParties,
} from "@/lib/credentials";
import type { VerificationStatus } from "@/types/credential";

export const runtime = "nodejs";

type EdgeHealth = "valid" | "warn" | "bad";

function worse(a: EdgeHealth, b: EdgeHealth): EdgeHealth {
  const rank = { valid: 0, warn: 1, bad: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

function healthOf(status: VerificationStatus): EdgeHealth {
  if (isCompromised(status)) return "bad";
  if (status === "EXPIRED") return "warn";
  return "valid";
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!orgHasAnalytics(me.organization?.type)) {
    return NextResponse.json({ error: "not available for this organization type" }, { status: 403 });
  }

  const where = credentialScope(me);

  const creds = (await prisma.credential.findMany({
    where,
    include: credentialInclude,
    orderBy: { createdAt: "desc" },
  })) as CredentialWithParties[];

  const statuses = await resolveStatuses(creds);
  const onChain = [...statuses.values()].some((s) => s.onChain);

  type NodeAcc = { id: string; label: string; type: "issuer" | "worker"; total: number; valid: number };
  type EdgeAcc = {
    source: string;
    target: string;
    issuer: string;
    worker: string;
    count: number;
    valid: number;
    health: EdgeHealth;
  };

  const nodes = new Map<string, NodeAcc>();
  const edges = new Map<string, EdgeAcc>();

  function touch(id: string, label: string, type: "issuer" | "worker", isValid: boolean) {
    const n = nodes.get(id) ?? { id, label, type, total: 0, valid: 0 };
    n.total += 1;
    if (isValid) n.valid += 1;
    nodes.set(id, n);
  }

  for (const c of creds) {
    const status = statuses.get(c.id)?.status ?? "NOT_FOUND";
    const ok = status === "VERIFIED";
    touch(c.issuerId, c.issuer.name, "issuer", ok);
    touch(c.workerId, c.worker.name, "worker", ok);

    const key = `${c.issuerId}->${c.workerId}`;
    const e =
      edges.get(key) ??
      ({
        source: c.issuerId,
        target: c.workerId,
        issuer: c.issuer.name,
        worker: c.worker.name,
        count: 0,
        valid: 0,
        health: "valid",
      } as EdgeAcc);
    e.count += 1;
    if (ok) e.valid += 1;
    e.health = worse(e.health, healthOf(status));
    edges.set(key, e);
  }

  const kind = me.role === "ADMIN" ? "network" : "ego";
  const centerId = kind === "ego" ? me.id : null;
  const centerType: "issuer" | "worker" = me.role === "ISSUER" ? "issuer" : "worker";

  if (kind === "ego" && !nodes.has(me.id)) {
    nodes.set(me.id, { id: me.id, label: me.name, type: centerType, total: 0, valid: 0 });
  }

  // Compliance indicator: surface holders in the admin's org who hold no
  // credential at all. They join the graph as disconnected nodes so coverage
  // gaps are visible at a glance, not just the people already credentialed.
  let uncredentialed = 0;
  if (kind === "network" && me.organizationId) {
    const orgWorkers = await prisma.user.findMany({
      where: { ...orgMemberFilter(me.organizationId), role: "WORKER" },
      select: { id: true, name: true },
    });
    for (const w of orgWorkers) {
      if (!nodes.has(w.id)) {
        nodes.set(w.id, { id: w.id, label: w.name, type: "worker", total: 0, valid: 0 });
        uncredentialed += 1;
      }
    }
  }

  return NextResponse.json({
    role: me.role,
    kind,
    centerId,
    centerType,
    onChain,
    uncredentialed,
    nodes: [...nodes.values()].map((n) => ({ ...n, credentialed: n.total > 0 })),
    edges: [...edges.values()],
  });
}
