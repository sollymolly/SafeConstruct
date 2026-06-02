"use client";

import { useState } from "react";

type Result = {
  credentialId: string;
  title: string;
  credentialType: string;
  issuerOrg: string;
  expiresAt: number;
  status: string;
};
type Worker = { name: string; email: string; address: string } | null;

const BADGE: Record<string, string> = {
  VERIFIED: "ok",
  REVOKED: "bad",
  EXPIRED: "warn",
  TAMPERED: "bad",
  NOT_FOUND: "bad",
};

export default function VerifyPage() {
  const [email, setEmail] = useState("");
  const [worker, setWorker] = useState<Worker>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResults(null);
    const r = await fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workerEmail: email }),
    });
    const d = await r.json();
    setBusy(false);
    setWorker(d.worker);
    setResults(d.results ?? []);
  }

  return (
    <section>
      <h1>Verify a worker</h1>
      <p className="lead">
        Look up a worker and confirm their safety credentials against the blockchain.
      </p>

      <form onSubmit={run} className="card form">
        <label>
          Worker email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="worker@example.com"
            required
          />
        </label>
        <button disabled={busy}>{busy ? "Checking the chain…" : "Verify"}</button>
      </form>

      {results &&
        (worker ? (
          <>
            <h2>
              {worker.name}{" "}
              <small className="who">
                {worker.address.slice(0, 6)}…{worker.address.slice(-4)}
              </small>
            </h2>
            {results.length === 0 ? (
              <p>No credentials on record.</p>
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
          </>
        ) : (
          <p className="msg">No worker found for that email.</p>
        ))}
    </section>
  );
}
