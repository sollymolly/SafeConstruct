"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Node = {
  id: string;
  label: string;
  type: "issuer" | "worker";
  total: number;
  valid: number;
  credentialed: boolean;
};
type Edge = {
  source: string;
  target: string;
  issuer: string;
  worker: string;
  count: number;
  valid: number;
  health: "valid" | "warn" | "bad";
};
type Data = {
  role: string;
  kind: "ego" | "network";
  centerId: string | null;
  centerType: "issuer" | "worker";
  onChain: boolean;
  uncredentialed: number;
  nodes: Node[];
  edges: Edge[];
};

const COPY: Record<string, { title: string; lead: string }> = {
  ADMIN: {
    title: "Workforce Trust Network",
    lead: "Every authority → holder credential link on your site, colored by live on-chain status.",
  },
  ISSUER: {
    title: "Your Issuance Network",
    lead: "Holders you've credentialed and the live, on-chain health of each link.",
  },
  WORKER: {
    title: "My Trust Graph",
    lead: "The authorities vouching for you — each link cryptographically verified on-chain.",
  },
};

const EDGE_COLOR = { valid: "34,197,94", warn: "245,158,11", bad: "239,68,68" };
const HEALTH_BADGE = { valid: "ok", warn: "warn", bad: "bad" } as const;

function nodeHealth(n: Node): "valid" | "warn" | "bad" {
  if (n.total === 0 || n.valid === n.total) return "valid";
  if (n.valid === 0) return "bad";
  return "warn";
}

export default function NetworkGraphPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/network")
      .then((r) => {
        if (r.status === 401) {
          setDenied(true);
          return null;
        }
        return r.json();
      })
      .then((d) => d && setData(d))
      .finally(() => setLoading(false));
  }, []);

  const pos = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!data) return map;
    if (data.kind === "ego" && data.centerId) {
      map.set(data.centerId, { x: 500, y: 300 });
      const neighbors = data.nodes.filter((n) => n.id !== data.centerId);
      const R = 235;
      neighbors.forEach((n, i) => {
        const a = (i / Math.max(1, neighbors.length)) * Math.PI * 2 - Math.PI / 2;
        map.set(n.id, { x: 500 + R * Math.cos(a), y: 300 + R * Math.sin(a) });
      });
    } else {
      const place = (arr: Node[], x: number) =>
        arr.forEach((n, i) => {
          const y = arr.length === 1 ? 300 : 60 + (i / (arr.length - 1)) * 480;
          map.set(n.id, { x, y });
        });
      place(data.nodes.filter((n) => n.type === "issuer"), 235);
      place(data.nodes.filter((n) => n.type === "worker"), 765);
    }
    return map;
  }, [data]);

  if (loading) return null;

  if (denied) {
    return (
      <section className="auth-container">
        <h1>Sign in to view your trust graph</h1>
        <p className="lead">Your network is built from your own verified credentials.</p>
        <Link href="/login?redirect=/network" className="card" style={{ display: "block" }}>
          Log in →
        </Link>
      </section>
    );
  }

  if (!data) return null;

  const copy = COPY[data.role] ?? COPY.WORKER;
  const authorities = data.nodes.filter((n) => n.type === "issuer").length;
  const holders = data.nodes.filter((n) => n.type === "worker").length;
  const pendingHolders = data.nodes.filter((n) => n.type === "worker" && !n.credentialed);
  const flagged = data.edges.filter((e) => e.health !== "valid");
  const neighbors = data.nodes.filter((n) => n.id !== data.centerId);
  // In the admin (network) view, disconnected "awaiting" holders are worth
  // drawing even with no links yet; only treat it as empty when there are no
  // nodes at all. Ego views still hinge on having at least one link.
  const empty = data.kind === "network" ? data.nodes.length === 0 : data.edges.length === 0;

  function isActive(id: string) {
    return !hovered || hovered === id;
  }
  function edgeActive(e: Edge) {
    return !hovered || hovered === e.source || hovered === e.target;
  }

  return (
    <section>
      <div className="search-header">
        <h1>{copy.title}</h1>
        <p className="lead">{copy.lead}</p>
      </div>

      <div className="dashboard-layout" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="graph-column">
        <div className="graph-card">
          {empty ? (
            <div className="empty-state" style={{ background: "transparent", border: "none" }}>
              <span style={{ fontSize: "3rem" }}>🕸️</span>
              <h3>No trust links yet</h3>
              <p>
                {data.role === "WORKER"
                  ? "Once an issuer credentials you, the link appears here."
                  : data.role === "ISSUER"
                    ? "Mint a credential to start building your network."
                    : "Credentials issued across the site will map here."}
              </p>
            </div>
          ) : (
            <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
              {data.edges.map((e, i) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const active = edgeActive(e);
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={`rgba(${EDGE_COLOR[e.health]}, ${active ? 0.6 : 0.06})`}
                    strokeWidth={Math.min(6, 1 + e.count)}
                  />
                );
              })}
              {data.nodes.map((n) => {
                const p = pos.get(n.id);
                if (!p) return null;
                const isCenter = n.id === data.centerId;
                const r = isCenter ? 24 : n.type === "issuer" ? 14 : 9;
                const active = isActive(n.id);
                // A holder with no credentials yet — a coverage gap. Draw it
                // hollow with a dashed grey ring so it reads as "awaiting".
                const pending = n.type === "worker" && !n.credentialed;
                const fill = pending
                  ? "var(--panel-2)"
                  : n.type === "issuer"
                    ? "var(--brand)"
                    : "var(--ok)";
                const stroke = pending
                  ? "rgba(148,163,184,0.8)"
                  : `rgba(${EDGE_COLOR[nodeHealth(n)]}, 0.9)`;

                let labelX = p.x;
                let labelY = isCenter ? p.y + r + 20 : p.y + r + 16;
                let anchor: "start" | "middle" | "end" = "middle";
                if (data.kind === "network") {
                  const left = n.type === "issuer";
                  labelX = left ? p.x - r - 8 : p.x + r + 8;
                  labelY = p.y + 4;
                  anchor = left ? "end" : "start";
                } else if (!isCenter) {
                  const dx = p.x - 500;
                  const dy = p.y - 300;
                  const len = Math.hypot(dx, dy) || 1;
                  labelX = p.x + (dx / len) * (r + 10);
                  labelY = p.y + (dy / len) * (r + 10) + 4;
                  anchor = dx > 30 ? "start" : dx < -30 ? "end" : "middle";
                }
                const label = n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label;

                return (
                  <g
                    key={n.id}
                    opacity={active ? 1 : 0.25}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={3}
                      strokeDasharray={pending ? "3 3" : undefined}
                    >
                      {isCenter && (
                        <animate attributeName="r" values={`${r};${r + 3};${r}`} dur="2.4s" repeatCount="indefinite" />
                      )}
                    </circle>
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor={anchor}
                      fontSize="13"
                      fill={active ? "var(--text)" : "var(--muted)"}
                      style={{ fontWeight: isCenter ? 700 : 500, pointerEvents: "none" }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

          <div className="graph-legend">
            <div className="row">
              <span className="dot" style={{ background: "var(--brand)" }} /> <small>Authority</small>
            </div>
            <div className="row">
              <span className="dot" style={{ background: "var(--ok)" }} /> <small>Holder</small>
            </div>
            {data.kind === "network" && (
              <div className="row">
                <span className="dot dot-pending" /> <small>Awaiting Credentials</small>
              </div>
            )}
            <span className="legend-sep" />
            <div className="row">
              <span className="dash" style={{ background: "var(--ok)" }} /> <small>Verified link</small>
            </div>
            <div className="row">
              <span className="dash" style={{ background: "var(--warn)" }} /> <small>Expired</small>
            </div>
            <div className="row">
              <span className="dash" style={{ background: "var(--bad)" }} /> <small>Revoked or Tampered</small>
            </div>
          </div>
        </div>

        <aside className="card">
          {data.role === "ADMIN" ? (
            <>
              <h3>Network Health</h3>
              <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "1rem", gap: "1rem" }}>
                <div className="who" style={{ display: "block" }}>Authorities<div className="metric-num" style={{ fontSize: "1.8rem" }}>{authorities}</div></div>
                <div className="who" style={{ display: "block" }}>Holders<div className="metric-num" style={{ fontSize: "1.8rem" }}>{holders}</div></div>
                <div className="who" style={{ display: "block" }}>Trust links<div className="metric-num" style={{ fontSize: "1.8rem" }}>{data.edges.length}</div></div>
                <div className="who" style={{ display: "block" }}>Awaiting credential<div className="metric-num" style={{ fontSize: "1.8rem", color: data.uncredentialed ? "var(--warn)" : "var(--ok)" }}>{data.uncredentialed}</div></div>
              </div>

              <h3 style={{ marginTop: "2rem" }}>
                Links Needing Attention{flagged.length > 0 ? ` (${flagged.length})` : ""}
              </h3>
              {flagged.length === 0 ? (
                <p className="msg" style={{ marginTop: "1rem" }}>All links verified on-chain. ✓</p>
              ) : (
                <div className="list" style={{ marginTop: "1rem" }}>
                  {flagged.slice(0, 12).map((e, i) => (
                    <div
                      key={i}
                      className="row between"
                      style={{ padding: "0.8rem 0", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={() => setHovered(e.target)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{e.worker}</div>
                        <small>{e.issuer}</small>
                      </div>
                      <span className={`badge ${HEALTH_BADGE[e.health]}`}>
                        {e.valid}/{e.count} ok
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {pendingHolders.length > 0 && (
                <>
                  <h3 style={{ marginTop: "2rem" }}>Holders Awaiting Credentials ({pendingHolders.length})</h3>
                  <div className="list" style={{ marginTop: "1rem" }}>
                    {pendingHolders.slice(0, 12).map((n) => (
                      <div
                        key={n.id}
                        className="row between"
                        style={{ padding: "0.8rem 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={() => setHovered(n.id)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <div className="row" style={{ gap: "0.6rem" }}>
                          <span className="dot dot-pending" />
                          <div style={{ fontWeight: 600 }}>{n.label}</div>
                        </div>
                        <span className="badge warn">NO CREDENTIAL</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h3>{data.role === "ISSUER" ? "Holders You've Credentialed" : "Authorities Vouching For You"}</h3>
              <p className="who" style={{ marginTop: "0.5rem" }}>
                {neighbors.length} connection{neighbors.length === 1 ? "" : "s"}
                {data.onChain ? " • verified on-chain" : " • DB fallback"}
              </p>
              {neighbors.length === 0 ? (
                <div className="empty-state" style={{ marginTop: "1.5rem" }}>
                  <p>No connections yet.</p>
                </div>
              ) : (
                <div className="list" style={{ marginTop: "1rem" }}>
                  {neighbors.map((n) => (
                    <div
                      key={n.id}
                      className="row between"
                      style={{ padding: "0.9rem 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      onMouseEnter={() => setHovered(n.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <div className="row" style={{ gap: "0.6rem" }}>
                        <span className="dot" style={{ background: n.type === "issuer" ? "var(--brand)" : "var(--ok)" }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{n.label}</div>
                          <small>{n.valid} of {n.total} valid</small>
                        </div>
                      </div>
                      <span className={`badge ${HEALTH_BADGE[nodeHealth(n)]}`}>
                        {nodeHealth(n) === "valid" ? "VERIFIED" : nodeHealth(n) === "warn" ? "CHECK" : "ALERT"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
