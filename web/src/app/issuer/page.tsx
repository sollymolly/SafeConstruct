"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canIssue } from "@/lib/roles";

type Me = { id: string; email: string; name: string; role: string; address: string | null } | null;
type Cred = {
  id: string;
  title: string;
  credentialType: string;
  issuerOrg: string;
  revokedAt: string | null;
};

export default function IssuerPage() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [workerEmail, setWorkerEmail] = useState("");
  const [credentialType, setCredentialType] = useState("OSHA-30");
  const [title, setTitle] = useState("OSHA 30-Hour Construction Safety");
  const [expiresAt, setExpiresAt] = useState("");
  const [issued, setIssued] = useState<Cred[]>([]);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        setLoading(false);
      });
  }, []);

  async function loadIssuedFor(em: string) {
    if (!em) return;
    const r = await fetch(`/api/credentials?workerEmail=${encodeURIComponent(em)}`);
    const d = await r.json();
    setIssued(d.credentials ?? []);
  }

  async function issue(e: React.FormEvent) {
  e.preventDefault();
  setMsg("");
  setError("");
  if (title.length < 5 || title.length > 100) return setError("Protocol Violation: Title must be between 5 and 100 bytes.");
  if (credentialType.length < 2 || credentialType.length > 30) return setError("Protocol Violation: Type code exceeds maximum 30 byte threshold.");
  setBusy(true);
  const r = await fetch("/api/credentials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workerEmail, credentialType, title, expiresAt: expiresAt || null }),
  });
  const d = await r.json();
  setBusy(false);
  if (d.error) return setError(d.error);
  setMsg(`Credential successfully minted (Tx: ${String(d.credential.txHash).slice(0, 12)}…)`);
  loadIssuedFor(workerEmail);
}

  async function revoke(id: string) {
    setBusy(true);
    await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    setBusy(false);
    loadIssuedFor(workerEmail);
  }

  if (loading) return null;

  if (!me) {
    return (
      <section className="auth-container">
        <h1>Issuer Portal</h1>
        <p className="lead">Log in with an authorized issuer account to mint credentials.</p>
        <Link href="/login?redirect=/issuer" className="card" style={{ display: "block" }}>
          Log in →
        </Link>
      </section>
    );
  }

  if (!canIssue(me.role)) {
    return (
      <section className="auth-container">
        <h1>Issuer access required</h1>
        <p className="lead">
          Your account ({me.email}) isn&apos;t an authorized issuer yet. Ask an admin to grant
          issuer access, then return here.
        </p>
        <Link href="/worker" className="card" style={{ display: "block" }}>
          Go to your wallet →
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div className="row between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Dashboard</h1>
          <p className="lead" style={{ margin: 0 }}>Manage and mint worker credentials.</p>
        </div>
        <div className="who" style={{ textAlign: 'right' }}>
          <strong>{me.name}</strong><br/>
          {me.address?.slice(0, 6)}…{me.address?.slice(-4)}
        </div>
      </div>

      <div className="dashboard-layout">
        <aside>
          <form onSubmit={issue} className="card form">
            <h3 style={{ marginBottom: '1rem' }}>Mint Credential</h3>
            <label>
              <div className="row between"><span>Worker Email Target</span><small>Max 80 chars</small></div>
              <input
                type="email"
                value={workerEmail}
                onChange={(e) => setWorkerEmail(e.target.value)}
                onBlur={() => loadIssuedFor(workerEmail)}
                placeholder="worker@example.com"
                minLength={5}
                maxLength={80}
                required
              />
            </label>
            <label>
              <div className="row between"><span>Credential Title</span><small>5-100 chars</small></div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} minLength={5} maxLength={100} required />
            </label>
            <div className="row">
              <label style={{ flex: 1 }}>
                <div className="row between"><span>Type Code</span><small>Max 30</small></div>
                <input
                  value={credentialType}
                  onChange={(e) => setCredentialType(e.target.value)}
                  minLength={2}
                  maxLength={30}
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Expiration
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </label>
            </div>
            
            <button disabled={busy} style={{ marginTop: '0.5rem' }}>
              {busy ? <span className="spinner"></span> : "Mint to Blockchain"}
            </button>
            {msg && <p className="msg">{msg}</p>}
            {error && <p className="msg error">{error}</p>}
          </form>
        </aside>

        <main>
          <h2>History for {workerEmail || "Target Worker"}</h2>
          {issued.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '3rem' }}>🔍</span>
              <h3>No History</h3>
              <p>Enter a worker's email to view their credentials issued by your organization.</p>
            </div>
          ) : (
            <ul className="list">
              {issued.map((c) => (
                <li key={c.id} className="card row between">
                  <div className="list-item-content">
                    <strong style={{ fontSize: '1.1rem' }}>{c.title}</strong>
                    <small>
                      {c.credentialType} • {c.revokedAt ? "Revoked" : "Active Status"}
                    </small>
                  </div>
                  {!c.revokedAt ? (
                    <button className="ghost" onClick={() => revoke(c.id)} disabled={busy}>
                      {busy ? "Revoking..." : "Revoke"}
                    </button>
                  ) : (
                    <span className="badge bad">REVOKED</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </section>
  );
}
