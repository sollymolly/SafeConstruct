"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string; role: string; address: string | null } | null;

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/auth?t=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="hero" style={{ paddingTop: '10rem' }}>
        <span className="spinner" style={{ margin: '0 auto', display: 'block' }}></span>
      </div>
    );
  }

  if (!me) {
    return (
      <section>
        <div className="hero" style={{ paddingBottom: '4rem' }}>
          <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', lineHeight: '1.1' }}>
            The Standard for Verifiable Safety
          </h1>
          <p className="lead" style={{ maxWidth: '800px', margin: '0 auto', fontSize: '1.25rem' }}>
            SafeConstruct anchors construction compliance directly to the blockchain. We eliminate
            credential fraud, automate compliance, and ensure your workforce is mathematically
            verified for the site.
          </p>
          <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/login">
              <button style={{ padding: '1.2rem 2.5rem', fontSize: '1.1rem' }}>Log In</button>
            </Link>
            <Link href="/signup">
              <button className="ghost" style={{ padding: '1.2rem 2.5rem', fontSize: '1.1rem' }}>
                Sign Up
              </button>
            </Link>
          </div>
        </div>

        <div style={{ marginTop: '2rem', marginBottom: '6rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2rem' }}>
            Advanced Protocol Capabilities
          </h2>
          <div className="dashboard-layout" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⛓️</div>
              <h3 style={{ fontSize: '1.25rem' }}>Immutable Audit Trails</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Every issuance, expiration, and revocation is permanently recorded on-chain, creating
                a cryptographic ledger that prevents retroactive forgery.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛡️</div>
              <h3 style={{ fontSize: '1.25rem' }}>Zero-Knowledge Verification</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Site Managers can validate a worker's safety clearance in real-time, relying entirely
                on mathematically proven hashes rather than physical paperwork.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌐</div>
              <h3 style={{ fontSize: '1.25rem' }}>Decentralized Mobility</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Workers carry a unified, instantly verifiable portfolio of their safety certifications
                across varying sites and competing employers.
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
          Welcome back, <strong>{me.name}</strong>. Select a module to proceed.
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