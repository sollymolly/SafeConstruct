"use client";

import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string; role: string; address: string | null } | null;

export default function ProfilePage() {
  const [me, setMe] = useState<Me>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  // Gate the email migration behind a confirmation dialog (the old email is
  // severed from the account, so we make the user acknowledge it first).
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setMe(d.user);
          setName(d.user.name);
          setEmail(d.user.email);
        }
      })
      .catch(() => setError("Could not load your profile. Please try again."));
  }, []);

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");

    // Only the email (login identity) is editable here. Validate before opening
    // the confirmation dialog so we never prompt for an invalid change.
    const next = email.trim().toLowerCase();
    if (next === me?.email) {
      return setError("Enter a different email address to migrate this account.");
    }
    if (next.length < 5 || next.length > 80) {
      return setError("Constraint Violation: Cryptographic Key (Email) must be between 5 and 80 bytes.");
    }

    setConfirmOpen(true);
  }

  async function confirmChange() {
    const next = email.trim().toLowerCase();
    setBusy(true);
    setMsg("");
    setError("");

    // Move the login to the new email. The server confirms it immediately, so the
    // old address is severed; all credentials + wallet stay with the account.
    const r = await fetch("/api/auth", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: next }),
    });
    const d = await r.json().catch(() => ({ error: "Unexpected server response." }));

    setBusy(false);
    setConfirmOpen(false);
    if (d.error) return setError(d.error);

    // Update local state to reflect changes instantly.
    setMe(d.user);
    setMsg("Login identity migrated. The previous email can no longer access this account.");

    // Reload after a moment so every view (and the navbar) reflects the new identity.
    setTimeout(() => { window.location.reload(); }, 1800);
  }

  if (!me) {
    return (
      <div className="hero">
        {error
          ? <p className="msg error" style={{ margin: "0 auto", maxWidth: "420px" }}>{error}</p>
          : <span className="spinner" style={{ margin: "0 auto", display: "block" }}></span>}
      </div>
    );
  }

  return (
    <section>
      {confirmOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div className="card" style={{ width: "100%", maxWidth: "460px" }}>
            <h2 style={{ marginTop: 0 }}>Confirm email change</h2>
            <p className="lead">
              This migrates your login from <strong>{me.email}</strong> to{" "}
              <strong>{email.trim().toLowerCase()}</strong>. The old email will be
              deleted from the system and will no longer be able to access this
              account. Your credentials and wallet stay with the account.
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
              <button type="button" className="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" onClick={confirmChange} disabled={busy} style={{ minWidth: "170px" }}>
                {busy ? <span className="spinner"></span> : "Yes, change email"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="search-header" style={{ marginBottom: "2rem" }}>
        <h1>Node Configuration</h1>
        <p className="lead">Manage your network identity parameters and cryptographic anchors.</p>
      </div>

      <div className="dashboard-layout">
        <aside>
          <div className="card">
            <h3 style={{ marginBottom: "1.5rem" }}>System Meta-Data</h3>
            <div className="form">
              <div>
                <small>Assigned Network Role</small>
                <div style={{ marginTop: "0.25rem" }}>
                  <span className={`badge ${me.role === "ADMIN" ? "warn" : me.role === "ISSUER" ? "brand" : "ok"}`}>
                    {me.role}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <small>Internal UUID</small>
                <div className="who" style={{ marginTop: "0.25rem", fontSize: "0.8rem", wordBreak: "break-all" }}>
                  {me.id}
                </div>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <small>Blockchain Custodian Address</small>
                <div className="who" style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
                  {me.address ? `${me.address.slice(0, 10)}...${me.address.slice(-8)}` : "Unassigned / Pending"}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main>
          <form onSubmit={handleUpdate} className="card form" style={{ padding: "2rem" }}>
            <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Identity Settings</h2>
            
            <label>
              <div className="row between">
                <span>Subject Identifier (Full Name)</span>
                <small>Read-only</small>
              </div>
              <input value={name} placeholder="Jane Doe" disabled />
            </label>

            <label style={{ marginTop: "1rem" }}>
              <div className="row between">
                <span>Contact Vector (Email)</span>
                <small>5-80 chars</small>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="node@network.com"
                minLength={5}
                maxLength={80}
                required
              />
            </label>

            {error && <div className="msg error" style={{ marginTop: "1.5rem" }}>{error}</div>}
            {msg && <div className="msg ok" style={{ marginTop: "1.5rem" }}>✓ {msg}</div>}

            <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button disabled={busy} style={{ minWidth: "200px" }}>
                {busy ? <span className="spinner"></span> : "Save Configurations"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </section>
  );
}