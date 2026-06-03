"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string; role: string; address: string | null } | null;

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  // View state: 'landing' shows project info, 'auth' shows login form
  const [view, setView] = useState<"landing" | "auth">("landing");

  // Auth form state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("WORKER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        setLoading(false);
      });
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (email.length < 5 || email.length > 80) return setError("Email must be between 5 and 80 characters.");
    if (name.length < 2 || name.length > 64) return setError("Name must be between 2 and 64 characters.");
    
    setBusy(true);
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    const d = await r.json();
    setBusy(false);
    
    if (d.error) return setError(d.error);
    
    // Reload page to update Navbar and show tabs globally
    window.location.reload();
  }

  // Simple loading state with no confusing text
  if (loading) {
    return (
      <div className="hero" style={{ paddingTop: '10rem' }}>
        <span className="spinner" style={{ margin: '0 auto', display: 'block' }}></span>
      </div>
    );
  }

  // LOGGED OUT STATE
  if (!me) {
    // Show Authentication Form
    if (view === "auth") {
      return (
        <section>
          <div className="hero" style={{ paddingBottom: '2rem' }}>
            <h1>Authentication Portal</h1>
            <p className="lead" style={{ maxWidth: '800px', margin: '0 auto' }}>
              Initialize your network node or access an existing cryptographic session to interact with the blockchain.
            </p>
          </div>

          <div className="auth-container" style={{ marginTop: '0' }}>
            <div style={{ padding: '2.5rem', background: 'var(--panel)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', textAlign: 'left' }}>
              <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.5rem' }}>
                {isSignUp ? "Register Node Identity" : "Establish Secure Session"}
              </h3>
              
              <form onSubmit={handleAuth} className="form">
                <label>
                  Assigned Network Role
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)}
                    style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.8rem 1rem', borderRadius: '10px', fontSize: '1rem', width: '100%', marginBottom: '0.5rem' }}
                  >
                    <option value="WORKER">Worker (Credential Custodian)</option>
                    <option value="ISSUER">Issuer (Authorized Minting Node)</option>
                    <option value="ADMIN">Site Manager (Verification Node)</option>
                  </select>
                </label>

                <label>
                  Subject Identifier (Full Name)
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    minLength={2}
                    maxLength={64}
                    required
                  />
                </label>

                <label>
                  Cryptographic Key (Email)
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

                {error && <div className="msg error" style={{ fontSize: '0.85rem' }}>{error}</div>}

                <button disabled={busy} style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}>
                  {busy ? <span className="spinner"></span> : (isSignUp ? "Sign Up" : "Log In")}
                </button>
                
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <small style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => setIsSignUp(!isSignUp)}>
                    {isSignUp ? "Already registered? Authenticate here." : "No identity? Register network node."}
                  </small>
                </div>
              </form>
            </div>
            <button onClick={() => setView("landing")} className="ghost" style={{ marginTop: '2rem', margin: '2rem auto', border: 'none', color: 'var(--muted)' }}>
              ← Return to Project Overview
            </button>
          </div>
        </section>
      );
    }

    // Show Beautiful Scholarly Landing Page
    return (
      <section>
        <div className="hero" style={{ paddingBottom: '4rem' }}>
          <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>The Enterprise Standard for Verifiable Safety</h1>
          <p className="lead" style={{ maxWidth: '800px', margin: '0 auto', fontSize: '1.25rem' }}>
            SafeConstruct anchors construction compliance directly to the blockchain. We eliminate credential fraud, automate compliance, and ensure your workforce is mathematically verified for the site.
          </p>
          <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => setView("auth")} style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
              Access Platform
            </button>
          </div>
        </div>

        <div style={{ marginTop: '2rem', marginBottom: '6rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2rem' }}>Advanced Protocol Capabilities</h2>
          <div className="dashboard-layout" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⛓️</div>
              <h3 style={{ fontSize: '1.25rem' }}>Immutable Audit Trails</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Every issuance, expiration, and revocation is permanently recorded on-chain, creating a highly resilient cryptographic ledger that prevents retroactive forgery.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛡️</div>
              <h3 style={{ fontSize: '1.25rem' }}>Zero-Knowledge Verification</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Site Managers can query the network to validate an incoming worker's safety clearance in real-time, relying entirely on mathematically proven hashes rather than physical paperwork.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌐</div>
              <h3 style={{ fontSize: '1.25rem' }}>Decentralized Mobility</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Workers act as self-sovereign nodes, carrying a unified, instantly verifiable portfolio of their safety certifications across varying sites and competing employers.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // LOGGED IN STATE
  return (
    <section>
      <div className="hero" style={{ paddingBottom: '3rem' }}>
        <h1>Network Dashboard</h1>
        <p className="lead">
          Active Session: <strong>{me.name}</strong>. Select a module to proceed.
        </p>
      </div>
      <div className="cards">
        <Link href="/issuer" className="card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏫</div>
          <h3>Issuer Portal</h3>
          <p>Secure dashboard for training providers to issue, manage, and instantly revoke credentials on-chain.</p>
        </Link>
        <Link href="/worker" className="card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👷</div>
          <h3>Worker Wallet</h3>
          <p>Your portable professional identity. Carry your verified safety history to any job site securely.</p>
        </Link>
        <Link href="/verify" className="card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</div>
          <h3>Live Verification</h3>
          <p>Site managers can query the blockchain to cryptographically confirm worker compliance instantly.</p>
        </Link>
      </div>
    </section>
  );
}