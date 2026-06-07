"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canIssue } from "@/lib/roles";
import { orgCanIssue } from "@/lib/orgTypes";
import type { CertDef } from "@/lib/certCatalog";

type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  address: string | null;
  orgType: string | null;
} | null;
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
  // Which credential is currently being revoked, so only THAT row shows
  // "Revoking…" — not every credential in the list (issue #2). Minting (busy)
  // and revoking are tracked separately so one never spills onto the other.
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [workerEmail, setWorkerEmail] = useState("");
  // The certifications this issuer is accredited to mint (catalog filtered to
  // their accredited categories) and the currently-typed/selected name.
  const [certs, setCerts] = useState<CertDef[]>([]);
  const [certQuery, setCertQuery] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [txHash, setTxHash] = useState("");
  const [issued, setIssued] = useState<Cred[]>([]);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        setLoading(false);
      });
    // The certs they may issue — only those their accreditation covers (fix #5/#7).
    fetch("/api/issuer/certs")
      .then((r) => r.json())
      .then((d) => setCerts(d.certs ?? []))
      .catch(() => {});
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
  setTxHash("");
  // The credential is chosen from the accredited list — resolve the typed name to
  // a catalog entry so we send its code + canonical title.
  const cert = certs.find((c) => c.name === certQuery);
  if (!cert) return setError("Choose a certification from the list.");
  setBusy(true);
  const r = await fetch("/api/credentials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workerEmail, credentialType: cert.code, title: cert.name, expiresAt: expiresAt || null }),
  });
  const d = await r.json().catch(() => ({}));
  setBusy(false);
  if (!r.ok || d.error) return setError(d.error || "Could not mint the credential.");
  setMsg("Credential successfully minted to the blockchain.");
  setTxHash(String(d.credential.txHash ?? ""));
  loadIssuedFor(workerEmail);
}

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/credentials/${id}`, { method: "DELETE" });
      await loadIssuedFor(workerEmail);
    } finally {
      setRevokingId(null);
    }
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
        <Link href="/" className="card" style={{ display: "block" }}>
          Back home →
        </Link>
      </section>
    );
  }

  if (!orgCanIssue(me.orgType)) {
    return (
      <section className="auth-container">
        <h1>Issuing isn&apos;t available here</h1>
        <p className="lead">
          Only training providers (schools) mint credentials. Your organization is set up to
          verify workers, not issue.
        </p>
        <Link href="/" className="card" style={{ display: "block" }}>
          Back home →
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
              <div className="row between">
                <span>Certification</span>
                <small>{certs.length > 0 ? "Search & select" : "None available"}</small>
              </div>
              <input
                list="issuer-cert-options"
                value={certQuery}
                onChange={(e) => setCertQuery(e.target.value)}
                placeholder={certs.length > 0 ? "Search certifications…" : "No accredited certifications"}
                disabled={certs.length === 0}
                autoComplete="off"
              />
              <datalist id="issuer-cert-options">
                {certs.map((c) => (
                  <option key={c.code} value={c.name}>{c.code}</option>
                ))}
              </datalist>
            </label>
            <label>
              Expiration
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>

            {certs.length === 0 && (
              <p className="msg error" style={{ marginTop: 0 }}>
                You aren&apos;t accredited to issue any certifications yet. Ask an accreditation body to accredit you, then refresh this page.
              </p>
            )}

            <button disabled={busy || certs.length === 0} style={{ marginTop: '0.5rem' }}>
              {busy ? <span className="spinner"></span> : "Mint to Blockchain"}
            </button>
            {msg && (
              <div className="msg" style={{ textAlign: "left" }}>
                {msg}
                {txHash && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <small style={{ display: "block", marginBottom: "0.2rem" }}>Transaction hash</small>
                    <code style={{ fontFamily: "monospace", fontSize: "0.78rem", wordBreak: "break-all", color: "var(--text)" }}>
                      {txHash}
                    </code>
                  </div>
                )}
              </div>
            )}
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
                    <button
                      className="ghost"
                      onClick={() => revoke(c.id)}
                      disabled={revokingId === c.id}
                    >
                      {revokingId === c.id ? "Revoking..." : "Revoke"}
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
