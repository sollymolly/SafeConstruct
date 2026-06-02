"use client";

import { useEffect, useState } from "react";
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);

  async function verify(workerEmail: string) {
    const r = await fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workerEmail }),
    });
    const d = await r.json();
    setResults(d.results ?? []);
  }

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        if (d.user?.email) verify(d.user.email);
      });
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, role: "WORKER" }),
    });
    const d = await r.json();
    setBusy(false);
    setMe(d.user);
    verify(email);
  }

  if (!me) {
    return (
      <section className="auth-container">
        <h1>Access Wallet</h1>
        <p className="lead">Your credentials travel with you across every employer.</p>
        <form onSubmit={signIn} className="card form">
          <label>
            Full Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan Smith"
              required
            />
          </label>
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@example.com"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? <span className="spinner"></span> : "Open Wallet"}
          </button>
        </form>
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