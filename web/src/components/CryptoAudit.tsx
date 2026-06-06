"use client";

import QRCodeWidget from "./QRCodeWidget";

type Proof = {
  credentialId: string;
  title: string;
  credentialType: string;
  issuerOrg: string;
  issuedAt: number;
  expiresAt: number;
  dataHash: string;
  issuerAddress: string;
  signature: string | null;
  signer: string | null;
  signatureValid: boolean;
  proof: string;
  accredited: boolean;
  accreditorName: string | null;
};

function short(v: string, head = 10, tail = 8) {
  return v.length > head + tail ? `${v.slice(0, head)}…${v.slice(-tail)}` : v;
}

export default function CryptoAudit({
  credential,
  onClose,
}: {
  credential: Proof;
  onClose: () => void;
}) {
  const c = credential;
  const signed = Boolean(c.signature);
  const publicUrl =
    typeof window !== "undefined" && c.proof ? `${window.location.origin}/v?d=${c.proof}` : "";

  // The exact EIP-712 payload the issuer signed — shown verbatim so the proof is
  // reproducible, not decorative.
  const typedData = {
    domain: { name: "SafeConstruct", version: "1" },
    primaryType: "Credential",
    message: {
      credentialId: c.credentialId,
      issuer: c.issuerAddress,
      issuerOrg: c.issuerOrg,
      credentialType: c.credentialType,
      title: c.title,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
    },
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="card" style={{ width: "100%", maxWidth: "820px", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        <button onClick={onClose} className="ghost" style={{ position: "absolute", top: "1rem", right: "1rem" }}>✕ Close</button>

        <h2>Cryptographic Audit Trail</h2>
        <p className="who" style={{ marginBottom: "1.5rem" }}>ID: {c.credentialId}</p>

        <div
          className="badge"
          style={{
            display: "inline-block",
            marginBottom: "2rem",
            background: signed ? (c.signatureValid ? "var(--ok)" : "var(--bad)") : "var(--panel-2)",
            color: signed ? "var(--text-dark)" : "var(--muted)",
            border: signed ? "none" : "1px solid var(--border)",
          }}
        >
          {signed
            ? c.signatureValid
              ? "✓ EIP-712 SIGNATURE VERIFIED"
              : "✗ SIGNATURE MISMATCH"
            : "NO SIGNATURE (LEGACY CREDENTIAL)"}
        </div>

        <div className="dashboard-layout" style={{ gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", color: "var(--muted)" }}>Lifecycle Timeline</h3>
            <div style={{ borderLeft: "2px solid var(--border)", marginLeft: "10px", paddingLeft: "1.5rem", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-31px", top: 0, width: "16px", height: "16px", borderRadius: "50%", background: "var(--brand)" }} />
                <strong style={{ display: "block" }}>Signed &amp; Minted On-Chain</strong>
                <small>By {c.issuerOrg}</small>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-31px", top: 0, width: "16px", height: "16px", borderRadius: "50%", background: c.signatureValid ? "var(--ok)" : "var(--bad)" }} />
                <strong style={{ display: "block", color: c.signatureValid ? "var(--ok)" : "var(--bad)" }}>Signature Recovered</strong>
                <small>{c.signatureValid ? "Signer matches issuer wallet." : signed ? "Recovered signer does not match." : "No signature on record."}</small>
              </div>
              {c.expiresAt ? (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "-31px", top: 0, width: "16px", height: "16px", borderRadius: "50%", background: "var(--border)" }} />
                  <strong style={{ display: "block", color: "var(--muted)" }}>Expiration</strong>
                  <small>{new Date(c.expiresAt * 1000).toLocaleDateString()}</small>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "1rem", color: "var(--muted)" }}>EIP-712 Signature Proof</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", margin: "1rem 0 1.5rem" }}>
              <div>
                <small>On-chain data hash (keccak256)</small>
                <div className="who" style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>{c.dataHash}</div>
              </div>
              <div>
                <small>Issuer wallet</small>
                <div className="who" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{short(c.issuerAddress, 12, 10)}</div>
              </div>
              <div>
                <small>Issuer accreditation</small>
                <div className="who" style={{ fontSize: "0.85rem", color: c.accredited ? "var(--ok)" : "var(--muted)" }}>
                  {c.accredited ? `${c.accreditorName} ✓` : "Not accredited"}
                </div>
              </div>
              <div>
                <small>Recovered signer</small>
                <div
                  className="who"
                  style={{ fontFamily: "monospace", fontSize: "0.8rem", color: c.signatureValid ? "var(--ok)" : signed ? "var(--bad)" : "var(--muted)" }}
                >
                  {c.signer ? short(c.signer, 12, 10) : "—"}
                </div>
              </div>
            </div>

            <small>Signed payload</small>
            <pre style={{ background: "#000", padding: "1.25rem", borderRadius: "8px", color: "var(--ok)", fontSize: "0.8rem", overflowX: "auto", border: "1px solid #112", marginTop: "0.4rem" }}>
{JSON.stringify(typedData, null, 2)}
            </pre>

            <small style={{ marginTop: "1rem", display: "block" }}>Signature (secp256k1)</small>
            <div style={{ background: "#000", padding: "1rem 1.25rem", borderRadius: "8px", border: "1px solid #112", marginTop: "0.4rem", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--ok)", wordBreak: "break-all" }}>
              {c.signature ?? "No signature on record."}
            </div>
          </div>
        </div>

        {publicUrl && (
          <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", color: "var(--muted)" }}>Public Verification</h3>
            <p className="who" style={{ margin: "0.4rem 0 1rem" }}>
              Anyone can re-verify this credential against the blockchain — no login or database access needed.
            </p>
            <div className="dashboard-layout" style={{ gridTemplateColumns: "auto 1fr", gap: "1.5rem", alignItems: "center" }}>
              <QRCodeWidget value={publicUrl} size={260} ecc="L" />
              <div>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", fontWeight: 600, wordBreak: "break-all", fontSize: "0.85rem" }}>
                  {publicUrl}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
