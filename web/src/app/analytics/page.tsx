"use client";

import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <section>
      <div className="search-header">
        <h1>Site Manager Intelligence</h1>
        <p className="lead">Real-time compliance analytics across the entire contractor workforce.</p>
      </div>

      <div className="dashboard-layout" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginBottom: "3rem" }}>
        <div className="card" style={{ borderTop: "4px solid var(--ok)" }}>
          <small>Active Valid Credentials</small>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "0.5rem" }}>1,248</div>
          <div className="badge ok" style={{ marginTop: "1rem", display: "inline-block" }}>↑ 12% THIS MONTH</div>
        </div>
        <div className="card" style={{ borderTop: "4px solid var(--warn)" }}>
          <small>Expiring in 30 Days</small>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "0.5rem" }}>34</div>
          <div className="badge warn" style={{ marginTop: "1rem", display: "inline-block" }}>REQUIRES RENEWAL</div>
        </div>
        <div className="card" style={{ borderTop: "4px solid var(--bad)" }}>
          <small>Revoked / Tampered Attempts</small>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "0.5rem" }}>7</div>
          <div className="badge bad" style={{ marginTop: "1rem", display: "inline-block" }}>SECURITY ALERT</div>
        </div>
      </div>

      <div className="dashboard-layout">
        <main className="card">
          <h3>Credential Distribution by Type</h3>
          <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {[
              { type: "OSHA-30", count: 842, color: "var(--brand)", width: "85%" },
              { type: "Forklift Operator", count: 215, color: "var(--ok)", width: "45%" },
              { type: "Crane Operator", count: 94, color: "var(--warn)", width: "25%" },
              { type: "Hazmat Handling", count: 47, color: "var(--bad)", width: "15%" }
            ].map((stat) => (
              <div key={stat.type}>
                <div className="row between" style={{ marginBottom: "0.5rem" }}>
                  <strong>{stat.type}</strong>
                  <span>{stat.count} active</span>
                </div>
                <div style={{ background: "var(--panel-2)", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ background: stat.color, width: stat.width, height: "100%", borderRadius: "6px" }} />
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside className="card">
          <h3>Recent On-Chain Activity</h3>
          <div className="list" style={{ marginTop: "1.5rem" }}>
            {[
              { act: "MINT", org: "ACME Training", time: "2 mins ago" },
              { act: "VERIFY", org: "Site Beta", time: "14 mins ago" },
              { act: "REVOKE", org: "OSHA Board", time: "1 hour ago" },
              { act: "VERIFY", org: "Site Alpha", time: "3 hours ago" },
            ].map((log, i) => (
              <div key={i} className="row between" style={{ padding: "1rem 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className={`badge ${log.act === "REVOKE" ? "bad" : log.act === "MINT" ? "ok" : "warn"}`} style={{ marginBottom: "0.5rem" }}>
                    {log.act}
                  </div>
                  <div><small>{log.org}</small></div>
                </div>
                <small>{log.time}</small>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}