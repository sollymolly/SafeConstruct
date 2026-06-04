"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCodeWidget from "../../components/QRCodeWidget";

type Me = { id: string; email: string; name: string; role: string; address: string | null } | null;
type Result = {
  credentialId: string;
  title: string;
  credentialType: string;
  issuerOrg: string;
  expiresAt: number;
  status: string;
};

const BADGE: Record<string, string> = {
  VERIFIED: "ok",
  REVOKED: "bad",
  EXPIRED: "warn",
  TAMPERED: "bad",
  NOT_FOUND: "bad",
};

export default function WorkerPage() {
  const [me, setMe] = useState<Me>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function verify(workerEmail: string) {
    setError("");
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workerEmail }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setResults([]);
        setError(d.error ?? "Could not verify credentials right now.");
        return;
      }
      setResults(d.results ?? []);
    } catch {
      setResults([]);
      setError("Could not reach the verification service.");
    }
  }

  useEffect(() => {
    fetch("/api/auth")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        setLoading(false);
        if (!r.ok) {
          setError(d.error ?? "Could not load your account. Please try again.");
          return;
        }
        setMe(d.user);
        if (d.user?.email) verify(d.user.email);
      })
      .catch(() => {
        setLoading(false);
        setError("Could not reach the server. Please try again.");
      });
  }, []);

  if (loading) return null;

  if (!me) {
    return (
      <section className="auth-container">
        <h1>Access Wallet</h1>
        <p className="lead">Your credentials travel with you across every employer.</p>
        {error && <p className="msg error" style={{ marginBottom: "1.5rem" }}>{error}</p>}
        <Link href="/login?redirect=/worker" className="card" style={{ display: "block" }}>
          Log in →
        </Link>
        <p className="lead" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          No account?{" "}
          <Link href="/signup" style={{ color: "var(--brand)", fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="dashboard-layout">
      <aside>
        <div className="card">
          <h3>Worker Profile</h3>
          <div className="form" style={{ marginTop: '1rem' }}>
            <div>
              <small>Name</small>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{me.name}</div>
            </div>
            <div>
              <small>Email</small>
              <div>{me.email}</div>
            </div>
            <div>
              <small>On-Chain Address</small>
              <div className="who" style={{ marginTop: '0.25rem' }}>
                {me.address?.slice(0, 8)}…{me.address?.slice(-6)}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem' }}>Present to Site Manager</h3>
          <QRCodeWidget value={me.email} />
        </div>
      </aside>

      <main>
        <div className="row between" style={{ marginBottom: '1.5rem' }}>
          <h2>My Active Credentials</h2>
          <div className="who">Total: {results.length}</div>
        </div>

        {error && <p className="msg error" style={{ marginBottom: '1.5rem' }}>{error}</p>}

        {results.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}>🪪</span>
            <h3>No credentials found</h3>
            <p>Ask your training provider to issue one to <strong>{me.email}</strong>.</p>
          </div>
        ) : (
          <ul className="list">
            {results.map((c) => (
              <li key={c.credentialId} className="card row between">
                <div className="list-item-content">
                  <strong style={{ fontSize: '1.1rem' }}>{c.title}</strong>
                  <small>
                    {c.credentialType} • Issued by {c.issuerOrg}
                    {c.expiresAt ? ` • Expires ${new Date(c.expiresAt * 1000).toLocaleDateString()}` : ""}
                  </small>
                </div>
                <span className={`badge ${BADGE[c.status] ?? ""}`}>{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </section>
  );
}
