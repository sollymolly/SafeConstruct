"use client";

import { useEffect, useState } from "react";

type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  address: string | null;
  organization: { id: string; name: string } | null;
} | null;

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

  // Self-service "switch organization" — independent state so it doesn't tangle
  // with the email form's busy/msg/error.
  const [orgCode, setOrgCode] = useState("");
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgMsg, setOrgMsg] = useState("");
  const [orgError, setOrgError] = useState("");
  // Like the email change, gate the org switch behind a confirmation dialog —
  // it drops any ISSUER/ADMIN access in the current org. targetOrg holds the
  // resolved destination (id + name) so the warning can name it.
  const [orgConfirmOpen, setOrgConfirmOpen] = useState(false);
  const [targetOrg, setTargetOrg] = useState<{ id: string; name: string } | null>(null);

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

  async function switchOrg(e: React.FormEvent) {
    e.preventDefault();
    setOrgMsg("");
    setOrgError("");

    const code = orgCode.trim().toUpperCase();
    if (!code) return setOrgError("Enter the new organization's join code.");

    setOrgBusy(true);
    // Resolve + validate the code first so the confirmation can name the
    // destination (and we don't prompt for an invalid or no-op switch).
    const res = await fetch("/api/orgs/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const org = await res.json().catch(() => ({}));
    setOrgBusy(false);
    if (!res.ok || !org.id) return setOrgError(org.error || "Unknown organization code.");
    if (org.id === me?.organization?.id) {
      return setOrgError(`You're already part of ${org.name}.`);
    }

    setTargetOrg({ id: org.id, name: org.name });
    setOrgConfirmOpen(true);
  }

  async function confirmSwitchOrg() {
    const code = orgCode.trim().toUpperCase();
    setOrgBusy(true);
    setOrgMsg("");
    setOrgError("");

    // Move this account to the org for `code`. Role is re-evaluated there (you
    // arrive as a worker unless you're that org's admin); credentials come along.
    const r = await fetch("/api/auth/organization", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await r.json().catch(() => ({ error: "Unexpected server response." }));
    setOrgBusy(false);
    setOrgConfirmOpen(false);
    if (!r.ok || d.error) return setOrgError(d.error || "Could not switch organizations.");

    setOrgMsg(`Moved to ${d.organization?.name ?? "the new organization"}. Reloading…`);
    // Reload so the navbar, role badge, and dashboards reflect the new org.
    setTimeout(() => { window.location.reload(); }, 1500);
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

      {orgConfirmOpen && targetOrg && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div className="card" style={{ width: "100%", maxWidth: "460px" }}>
            <h2 style={{ marginTop: 0 }}>Confirm organization switch</h2>
            <p className="lead">
              This moves your account from{" "}
              <strong>{me.organization?.name ?? "no organization"}</strong> to{" "}
              <strong>{targetOrg.name}</strong>. You&apos;ll re-join as a worker
              unless you&apos;re {targetOrg.name}&apos;s admin, so any issuer or
              admin access in your current organization is removed. Your credentials
              and wallet stay with the account.
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
              <button type="button" className="ghost" onClick={() => setOrgConfirmOpen(false)} disabled={orgBusy}>
                Cancel
              </button>
              <button type="button" onClick={confirmSwitchOrg} disabled={orgBusy} style={{ minWidth: "170px" }}>
                {orgBusy ? <span className="spinner"></span> : "Yes, switch"}
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
                <small>Organization</small>
                <div style={{ marginTop: "0.25rem", fontWeight: 600 }}>
                  {me.organization?.name ?? "Unassigned"}
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

          <form onSubmit={switchOrg} className="card form" style={{ padding: "2rem", marginTop: "1.5rem" }}>
            <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Organization</h2>
            <p className="lead" style={{ marginTop: 0 }}>
              You belong to <strong>{me.organization?.name ?? "no organization yet"}</strong>.
              Moving to another company? Enter its join code to switch — your
              credentials come with you, and you&apos;ll re-join as a worker unless
              you&apos;re that company&apos;s admin.
            </p>

            <label>
              <div className="row between">
                <span>New Organization Code</span>
                <small>From the new company&apos;s admin</small>
              </div>
              <input
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value)}
                placeholder="NEWCO-3X9P"
                autoCapitalize="characters"
                style={{ textTransform: "uppercase" }}
              />
            </label>

            {orgError && <div className="msg error" style={{ marginTop: "1.5rem" }}>{orgError}</div>}
            {orgMsg && <div className="msg ok" style={{ marginTop: "1.5rem" }}>✓ {orgMsg}</div>}

            <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="ghost" disabled={orgBusy} style={{ minWidth: "200px" }}>
                {orgBusy ? <span className="spinner"></span> : "Switch Organization"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </section>
  );
}