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

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setMe(d.user);
          setName(d.user.name);
          setEmail(d.user.email);
        }
      });
  }, []);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");

    // Scientific Validation
    if (name.length < 2 || name.length > 64) {
      setBusy(false);
      return setError("Constraint Violation: Subject Name must be between 2 and 64 characters.");
    }
    if (email.length < 5 || email.length > 80) {
      setBusy(false);
      return setError("Constraint Violation: Cryptographic Key (Email) must be between 5 and 80 bytes.");
    }

    // Call API to update the session (Using existing auth endpoint behavior to update)
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, role: me?.role }),
    });
    const d = await r.json();
    
    setBusy(false);
    if (d.error) return setError(d.error);
    
    setMsg("Identity parameters successfully updated on the network.");
    
    // Update local state to reflect changes instantly
    setMe(d.user);
    
    // Optionally reload after 1.5 seconds to refresh the Navbar name
    setTimeout(() => { window.location.reload(); }, 1500);
  }

  if (!me) {
    return <div className="hero"><span className="spinner" style={{margin: '0 auto', display: 'block'}}></span></div>;
  }

  return (
    <section>
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
                <small>2-64 chars</small>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                minLength={2}
                maxLength={64}
                required
              />
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