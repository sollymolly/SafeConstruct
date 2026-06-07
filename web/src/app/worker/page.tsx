"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCodeWidget from "../../components/QRCodeWidget";
import { orgHasWorkerWallet } from "@/lib/orgTypes";

type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  address: string | null;
  orgType: string | null;
  // Training providers (schools) the worker belongs to — the orgs allowed to
  // issue credentials to them.
  schools: { id: string; name: string }[];
} | null;
type Result = {
  credentialId: string;
  title: string;
  credentialType: string;
  issuerOrg: string;
  expiresAt: number;
  status: string;
  proof: string;
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

  if (!orgHasWorkerWallet(me.orgType)) {
    return (
      <section className="auth-container">
        <h1>No wallet for accreditation bodies</h1>
        <p className="lead">
          Accreditation bodies vouch for training providers — they don&apos;t hold worker
          credentials, so there&apos;s no wallet here.
        </p>
        <Link href="/" className="card" style={{ display: "block" }}>
          Back home →
        </Link>
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
              <div className="who" style={{ marginTop: "0.25rem"}}>
                  {me.address ? me.address : "Unassigned / Pending"}
                </div>
            </div>
            <div>
              <small>Training Providers</small>
              {me.schools.length === 0 ? (
                <div style={{ marginTop: '0.25rem', color: 'var(--muted)' }}>None yet</div>
              ) : (
                <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                  {me.schools.map((s) => (
                    <span key={s.id} className="badge">{s.name}</span>
                  ))}
                </div>
              )}
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
                <div className="row" style={{ gap: '0.75rem' }}>
                  {c.proof && (
                    <a
                      href={`/v?d=${c.proof}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge"
                      style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'transparent', textDecoration: 'none' }}
                    >
                      Public Proof ↗
                    </a>
                  )}
                  <span className={`badge ${BADGE[c.status] ?? ""}`}>{c.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </section>
  );
}
