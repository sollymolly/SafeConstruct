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

  // sign-in fields
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");

  // issue form
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
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: org, role: "ISSUER" }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) return setMsg(d.error);
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
    const r = await fetch("/api/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workerEmail, credentialType, title, expiresAt: expiresAt || null }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) return setMsg(d.error);
    setMsg(`Issued ✓  (tx ${String(d.credential.txHash).slice(0, 12)}…)`);
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
      <section>
        <h1>Issuer sign-in</h1>
        <p className="lead">Training providers issue safety credentials to workers.</p>
        <form onSubmit={signIn} className="card form">
          <label>
            Organization name
            <input
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="ACME Safety Training"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="issuer@acme.com"
              required
            />
          </label>
          <button disabled={busy}>{busy ? "…" : "Sign in as issuer"}</button>
          {msg && <p className="msg">{msg}</p>}
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="row between">
        <h1>Issue credentials</h1>
        <span className="who">
          {me.name} · {me.address?.slice(0, 6)}…{me.address?.slice(-4)}
        </span>
      </div>

      <form onSubmit={issue} className="card form">
        <label>
          Worker email
          <input
            type="email"
            value={workerEmail}
            onChange={(e) => setWorkerEmail(e.target.value)}
            onBlur={() => loadIssuedFor(workerEmail)}
            placeholder="worker@example.com"
            required
          />
        </label>
        <div className="row">
          <label>
            Type
            <input
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              required
            />
          </label>
          <label>
            Expires (optional)
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        </div>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <button disabled={busy}>{busy ? "Issuing on-chain…" : "Issue credential"}</button>
        {msg && <p className="msg">{msg}</p>}
      </form>

      {issued.length > 0 && (
        <>
          <h2>Credentials for {workerEmail}</h2>
          <ul className="list">
            {issued.map((c) => (
              <li key={c.id} className="card row between">
                <div>
                  <strong>{c.title}</strong>
                  <br />
                  <small>
                    {c.credentialType} · {c.issuerOrg} · {c.revokedAt ? "revoked" : "active"}
                  </small>
                </div>
                {!c.revokedAt && (
                  <button className="ghost" onClick={() => revoke(c.id)} disabled={busy}>
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
