"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { hashCredential } from "@/lib/hash";
import { decodeProof } from "@/lib/proof";
import type { CredentialRecord } from "@/types/credential";

type Verdict = {
  status: string;
  record: CredentialRecord;
  expectedHash: string;
  onChain: { exists: boolean; dataHash: string; revoked: boolean; issuer: string; worker: string };
  signature: string | null;
  signer: string | null;
  signatureValid: boolean;
  accredited: boolean;
  accreditorName: string | null;
};

const STATUS_COPY: Record<string, { badge: string; label: string; blurb: string }> = {
  VERIFIED: { badge: "ok", label: "Verified", blurb: "This credential is anchored on-chain, untampered, signed by the issuer, and currently valid." },
  EXPIRED: { badge: "warn", label: "Expired", blurb: "This credential is authentic but has passed its expiry date." },
  REVOKED: { badge: "bad", label: "Revoked", blurb: "The issuer has revoked this credential on-chain." },
  TAMPERED: { badge: "bad", label: "Tampered", blurb: "The presented record does not match the hash committed on-chain — it has been altered." },
  NOT_FOUND: { badge: "bad", label: "Not Found", blurb: "No matching credential exists on-chain for this proof." },
};

function short(v: string, head = 10, tail = 8) {
  return v && v.length > head + tail ? `${v.slice(0, head)}…${v.slice(-tail)}` : v;
}

function Row({ label, value, mono = false, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div style={{ padding: "0.7rem 0", borderBottom: "1px solid var(--border)" }}>
      <small>{label}</small>
      <div style={{ fontFamily: mono ? "monospace" : undefined, fontSize: mono ? "0.8rem" : "1rem", wordBreak: "break-all", color, fontWeight: mono ? 400 : 600 }}>
        {value}
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: "0.6rem", padding: "0.4rem 0" }}>
      <span style={{ color: ok ? "var(--ok)" : "var(--bad)", fontWeight: 700 }}>{ok ? "✓" : "✗"}</span>
      <small style={{ color: "var(--text)" }}>{children}</small>
    </div>
  );
}

function VerifyInner() {
  const params = useSearchParams();
  const d = params.get("d");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [localHash, setLocalHash] = useState("");

  useEffect(() => {
    if (!d) {
      setError("No proof provided. Scan a SafeConstruct credential QR to verify it here.");
      setLoading(false);
      return;
    }
    // Independent, in-browser hash of the record carried in the QR — so you can
    // see the hash is computed locally and matches the on-chain anchor below.
    try {
      const { record } = decodeProof(d);
      setLocalHash(hashCredential(record));
    } catch {
      /* surfaced by the API error path below */
    }
    fetch("/api/v", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ d }) })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Verification failed");
        setVerdict(j as Verdict);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [d]);

  if (loading) {
    return (
      <section className="auth-container">
        <span className="spinner" style={{ margin: "2rem auto", display: "block" }} />
        <p className="lead">Verifying against the public blockchain…</p>
      </section>
    );
  }

  if (error || !verdict) {
    return (
      <section className="auth-container">
        <h1>Credential Verification</h1>
        <p className="msg error" style={{ marginTop: "1rem" }}>{error || "Could not verify this proof."}</p>
        <Link href="/" className="card" style={{ display: "block", marginTop: "1.5rem" }}>Back home →</Link>
      </section>
    );
  }

  const c = STATUS_COPY[verdict.status] ?? STATUS_COPY.NOT_FOUND;
  const r = verdict.record;
  const hashMatch = verdict.onChain.exists && verdict.expectedHash.toLowerCase() === verdict.onChain.dataHash.toLowerCase();
  const localMatch = !!localHash && localHash.toLowerCase() === verdict.onChain.dataHash.toLowerCase();

  return (
    <section style={{ maxWidth: "760px", margin: "0 auto" }}>
      <div className="search-header">
        <h1>Credential Verification</h1>
        <p className="lead">Checked live against the public blockchain — no account or company database required.</p>
      </div>

      <div className="card" style={{ textAlign: "center", borderTop: `4px solid var(--${c.badge === "ok" ? "ok" : c.badge === "warn" ? "warn" : "bad"})` }}>
        <span className={`badge ${c.badge}`} style={{ fontSize: "1rem", padding: "0.5rem 1.2rem" }}>{c.label.toUpperCase()}</span>
        <h2 style={{ margin: "1rem 0 0.5rem" }}>{r.title}</h2>
        <p className="who">{r.credentialType} • Issued by {r.issuerOrg}</p>
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>{c.blurb}</p>
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>What was checked</h3>
        <Check ok={verdict.onChain.exists}>Anchored on-chain (the credential exists in the registry)</Check>
        <Check ok={hashMatch}>Record matches the on-chain hash (not tampered)</Check>
        <Check ok={!verdict.onChain.revoked}>Not revoked by the issuer</Check>
        <Check ok={verdict.signatureValid}>Issuer signature recovered and matches the on-chain issuer</Check>
        <Check ok={verdict.accredited}>
          {verdict.accredited
            ? `Issuer accredited by ${verdict.accreditorName}`
            : "Issuer is not accredited by a recognized body"}
        </Check>
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Cryptographic detail</h3>
        <Row label="Credential ID" value={r.credentialId} mono />
        <Row label="Hash computed in your browser" value={localHash || "—"} mono color={localMatch ? "var(--ok)" : undefined} />
        <Row label="Hash anchored on-chain (keccak256)" value={verdict.onChain.dataHash} mono />
        <Row label="Issuer wallet (claimed)" value={short(r.issuerAddress, 12, 10)} mono />
        <Row label="Recovered signer" value={verdict.signer ? short(verdict.signer, 12, 10) : "—"} mono color={verdict.signatureValid ? "var(--ok)" : "var(--bad)"} />
        <Row label="On-chain issuer" value={short(verdict.onChain.issuer, 12, 10)} mono />
        <Row label="Issuer accreditation" value={verdict.accredited ? `${verdict.accreditorName} ✓` : "Not accredited"} color={verdict.accredited ? "var(--ok)" : "var(--muted)"} />
        {r.expiresAt ? <Row label="Expires" value={new Date(r.expiresAt * 1000).toLocaleDateString()} /> : null}
      </div>

      <p className="who" style={{ textAlign: "center", marginTop: "1.5rem" }}>
        Powered by <Link href="/" style={{ color: "var(--brand)", fontWeight: 600 }}>SafeConstruct</Link>
      </p>
    </section>
  );
}

export default function PublicVerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
