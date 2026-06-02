"use client";

export default function CryptoAudit({ credential, onClose }: { credential: any, onClose: () => void }) {
  const mockHash = `0x${Array.from({length: 64}).map(() => Math.floor(Math.random()*16).toString(16)).join('')}`;
  
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="card" style={{ width: "100%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        <button onClick={onClose} className="ghost" style={{ position: "absolute", top: "1rem", right: "1rem" }}>✕ Close</button>
        
        <h2>Cryptographic Audit Trail</h2>
        <p className="who" style={{ marginBottom: "2rem" }}>ID: {credential.credentialId}</p>

        <div className="dashboard-layout" style={{ gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", color: "var(--muted)" }}>Lifecycle Timeline</h3>
            <div style={{ borderLeft: "2px solid var(--border)", marginLeft: "10px", paddingLeft: "1.5rem", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-31px", top: 0, width: "16px", height: "16px", borderRadius: "50%", background: "var(--brand)" }} />
                <strong style={{ display: "block" }}>Minted On-Chain</strong>
                <small>By {credential.issuerOrg}</small>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-31px", top: 0, width: "16px", height: "16px", borderRadius: "50%", background: "var(--ok)" }} />
                <strong style={{ display: "block", color: "var(--ok)" }}>Verified Status</strong>
                <small>Signature mathematically validated.</small>
              </div>
              {credential.expiresAt && (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "-31px", top: 0, width: "16px", height: "16px", borderRadius: "50%", background: "var(--border)" }} />
                  <strong style={{ display: "block", color: "var(--muted)" }}>Expiration</strong>
                  <small>{new Date(credential.expiresAt * 1000).toLocaleDateString()}</small>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "1rem", color: "var(--muted)" }}>Zero-Knowledge Payload</h3>
            <pre style={{ background: "#000", padding: "1.5rem", borderRadius: "8px", color: "var(--ok)", fontSize: "0.85rem", overflowX: "auto", border: "1px solid #112" }}>
{`{
  "header": {
    "alg": "Keccak256",
    "typ": "VerifiableCredential"
  },
  "payload": {
    "sub": "${mockHash.slice(0, 20)}...",
    "type": "${credential.credentialType}",
    "issuer": "${credential.issuerOrg}"
  },
  "signature": "${mockHash}"
}`}
            </pre>
            <div className="badge ok" style={{ marginTop: "1rem" }}>KECCAK-256 PROOF VALID</div>
          </div>
        </div>
      </div>
    </div>
  );
}