"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Metrics = {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  compromised: number;
  complianceRate: number;
  workers: number;
  issuers: number;
};

type Dist = { type: string; total: number; valid: number; width: string; color: string };

type Activity = {
  action: string;
  status: string;
  title: string;
  credentialType: string;
  issuerOrg: string;
  workerName: string;
  txHash: string | null;
  at: string;
};

type Data = {
  role: string;
  name: string;
  metrics: Metrics;
  distribution: Dist[];
  activity: Activity[];
  onChain: { verified: number; total: number };
};

const COPY: Record<string, { title: string; lead: string; peopleLabel: string }> = {
  ADMIN: {
    title: "Site Manager Intelligence",
    lead: "Live compliance across your entire contractor workforce, every status proven on-chain.",
    peopleLabel: "Workers on site",
  },
  ISSUER: {
    title: "Issuance Analytics",
    lead: "Every credential your organization has minted, re-verified against the blockchain in real time.",
    peopleLabel: "Workers credentialed",
  },
  WORKER: {
    title: "My Compliance",
    lead: "The live, tamper-proof status of every credential in your wallet.",
    peopleLabel: "Issuers vouching for you",
  },
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const ACTION_BADGE: Record<string, string> = { MINT: "ok", VERIFY: "warn", REVOKE: "bad", ALERT: "bad" };

export default function AnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    fetch("/api/analytics")
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

  if (loading) return null;

  if (denied) {
    return (
      <section className="auth-container">
        <h1>Sign in to view analytics</h1>
        <p className="lead">Your compliance dashboard is tailored to your account.</p>
        <Link href="/login?redirect=/analytics" className="card" style={{ display: "block" }}>
          Log in →
        </Link>
      </section>
    );
  }

  if (!data) return null;

  const copy = COPY[data.role] ?? COPY.WORKER;
  const m = data.metrics;
  const peopleValue = data.role === "WORKER" ? m.issuers : m.workers;
  const ring = `conic-gradient(var(--ok) ${m.complianceRate * 3.6}deg, var(--panel-2) 0deg)`;

  return (
    <section>
      <div className="search-header">
        <h1>{copy.title}</h1>
        <p className="lead">{copy.lead}</p>
      </div>

      <div className="metric-grid">
        <div className="card metric-hero">
          <div className="ring" style={{ background: ring }}>
            <div className="ring-inner">
              <strong>{m.complianceRate}%</strong>
              <small>compliant</small>
            </div>
          </div>
          <div>
            <small>On-Chain Compliance Rate</small>
            <div className="who" style={{ marginTop: "0.75rem" }}>
              {data.onChain.verified} / {data.onChain.total} proven on-chain
            </div>
          </div>
        </div>

        <div className="card" style={{ borderTop: "4px solid var(--ok)" }}>
          <small>Active Valid Credentials</small>
          <div className="metric-num">{m.valid}</div>
          <div className="badge ok" style={{ display: "inline-block" }}>VERIFIED LIVE</div>
        </div>

        <div className="card" style={{ borderTop: "4px solid var(--warn)" }}>
          <small>Expiring in 30 Days</small>
          <div className="metric-num">{m.expiringSoon}</div>
          <div className="badge warn" style={{ display: "inline-block" }}>
            {m.expiringSoon > 0 ? "NEEDS RENEWAL" : "ALL CURRENT"}
          </div>
        </div>

        <div className="card" style={{ borderTop: "4px solid var(--bad)" }}>
          <small>Revoked / Tampered</small>
          <div className="metric-num">{m.compromised}</div>
          <div className={`badge ${m.compromised > 0 ? "bad" : "ok"}`} style={{ display: "inline-block" }}>
            {m.compromised > 0 ? "SECURITY ALERT" : "NONE DETECTED"}
          </div>
        </div>
      </div>

      <div className="dashboard-layout" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: "3rem" }}>
        <main className="card">
          <div className="row between">
            <h3 style={{ margin: 0 }}>Credential Distribution by Type</h3>
            <span className="who">{copy.peopleLabel}: {peopleValue}</span>
          </div>
          {data.distribution.length === 0 ? (
            <div className="empty-state" style={{ marginTop: "1.5rem" }}>
              <span style={{ fontSize: "2.5rem" }}>📊</span>
              <h3>No credentials yet</h3>
              <p>Once credentials exist, their breakdown appears here.</p>
            </div>
          ) : (
            <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {data.distribution.map((s) => (
                <div key={s.type}>
                  <div className="row between" style={{ marginBottom: "0.5rem" }}>
                    <strong>{s.type}</strong>
                    <span>
                      <small>{s.valid} valid / </small>
                      {s.total} total
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ background: s.color, width: s.width }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <aside className="card">
          <h3>Recent On-Chain Activity</h3>
          {data.activity.length === 0 ? (
            <div className="empty-state" style={{ marginTop: "1.5rem" }}>
              <span style={{ fontSize: "2.5rem" }}>⛓️</span>
              <p>No ledger activity yet.</p>
            </div>
          ) : (
            <div className="list" style={{ marginTop: "1.5rem" }}>
              {data.activity.map((log, i) => (
                <div key={i} className="row between" style={{ padding: "0.9rem 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div className={`badge ${ACTION_BADGE[log.action] ?? "warn"}`} style={{ marginBottom: "0.5rem", display: "inline-block" }}>
                      {log.action}
                    </div>
                    <div style={{ fontWeight: 600 }}>{log.title}</div>
                    <small>
                      {data.role === "WORKER"
                        ? log.issuerOrg
                        : data.role === "ISSUER"
                          ? log.workerName
                          : `${log.issuerOrg} → ${log.workerName}`}
                    </small>
                    {log.txHash && (
                      <div className="who" style={{ marginTop: "0.4rem", fontFamily: "monospace", fontSize: "0.7rem" }}>
                        {log.txHash.slice(0, 10)}…{log.txHash.slice(-6)}
                      </div>
                    )}
                  </div>
                  <small style={{ whiteSpace: "nowrap" }}>{timeAgo(log.at)}</small>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
