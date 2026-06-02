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
      <div className="search-header">
        <h1>Global Site Verification</h1>
        <p className="lead">
          Instantly query the blockchain to cryptographically confirm any incoming worker's safety credentials and licenses.
        </p>

        <form onSubmit={run} className="card form" style={{ padding: '2rem', display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '1rem' }}>
          <label style={{ flex: 1, textAlign: 'left' }}>
            Worker Identifier (Email)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@example.com"
              required
            />
          </label>
          <button disabled={busy} style={{ minWidth: '160px', height: '44px' }}>
            {busy ? <span className="spinner"></span> : "Scan Blockchain"}
          </button>
        </form>
      </div>

      {results && (
        <div style={{ marginTop: '4rem' }}>
          {worker ? (
            <div className="dashboard-layout">
              <aside>
                <div className="card">
                  <h3>Subject Verified</h3>
                  <div className="form" style={{ marginTop: '1rem' }}>
                    <div>
                      <small>Full Name</small>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{worker.name}</div>
                    </div>
                    <div>
                      <small>Cryptographic Anchor</small>
                      <div className="who" style={{ marginTop: '0.25rem' }}>
                        {worker.address.slice(0, 8)}…{worker.address.slice(-6)}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <main>
                <h2 style={{ marginTop: 0 }}>Verification Results</h2>
                {results.length === 0 ? (
                  <div className="empty-state">
                    <h3>Clear Record</h3>
                    <p>No safety credentials were found on the blockchain for this worker.</p>
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
            </div>
          ) : (
            <div className="empty-state">
              <span style={{ fontSize: '3rem' }}>❌</span>
              <h3>Verification Failed</h3>
              <p>No worker profile or cryptographic anchor exists for <strong>{email}</strong>.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}