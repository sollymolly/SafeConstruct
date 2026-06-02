"use client";

import { useEffect, useState } from "react";

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");

  const [workerEmail, setWorkerEmail] = useState("");
  const [credentialType, setCredentialType] = useState("OSHA-30");
  const [title, setTitle] = useState("OSHA 30-Hour Construction Safety");
  const [expiresAt, setExpiresAt] = useState("");
  const [issued, setIssued] = useState<Cred[]>([]);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setMe(d.user));
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: org, role: "ISSUER" }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) return setError(d.error);
    setMe(d.user);
  }

  async function loadIssuedFor(em: string) {
    if (!em) return;
    const r = await fetch(`/api/credentials?workerEmail=${encodeURIComponent(em)}`);
    const d = await r.json();
    setIssued(d.credentials ?? []);
  }

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
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

  if (!me || me.role !== "ISSUER") {
    return (
      <section className="auth-container">
        <h1>Issuer Portal</h1>
        <p className="lead">Authorized training providers dashboard.</p>
        <form onSubmit={signIn} className="card form">
          <label>
            Organization Name
            <input
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="ACME Safety Training"
              required
            />
          </label>
          <label>
            Authorized Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="issuer@acme.com"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? <span className="spinner"></span> : "Sign In to Dashboard"}
          </button>
          {error && <p className="msg error">{error}</p>}
        </form>
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
              Worker Email Target
              <input
                type="email"
                value={workerEmail}
                onChange={(e) => setWorkerEmail(e.target.value)}
                onBlur={() => loadIssuedFor(workerEmail)}
                placeholder="worker@example.com"
                required
              />
            </label>
            <label>
              Credential Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <div className="row">
              <label style={{ flex: 1 }}>
                Type Code
                <input
                  value={credentialType}
                  onChange={(e) => setCredentialType(e.target.value)}
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