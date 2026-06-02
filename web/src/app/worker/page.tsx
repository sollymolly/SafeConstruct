"use client";

import { useEffect, useState } from "react";

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
      <section>
        <h1>Worker sign-in</h1>
        <p className="lead">Your credentials travel with you across every employer.</p>
        <form onSubmit={signIn} className="card form">
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan Smith"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@example.com"
              required
            />
          </label>
          <button disabled={busy}>{busy ? "…" : "Sign in"}</button>
        </form>
      </section>
    );
  }

  return (
    <section>
      <h1>My credentials</h1>
      <p className="who">
        {me.name} · wallet {me.address?.slice(0, 6)}…{me.address?.slice(-4)}
      </p>
      {results.length === 0 ? (
        <p className="lead">
          No credentials yet. Ask your training provider to issue one to {me.email}.
        </p>
      ) : (
        <ul className="list">
          {results.map((c) => (
            <li key={c.credentialId} className="card row between">
              <div>
                <strong>{c.title}</strong>
                <br />
                <small>
                  {c.credentialType} · {c.issuerOrg}
                  {c.expiresAt
                    ? ` · expires ${new Date(c.expiresAt * 1000).toLocaleDateString()}`
                    : ""}
                </small>
              </div>
              <span className={`badge ${BADGE[c.status] ?? ""}`}>{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
