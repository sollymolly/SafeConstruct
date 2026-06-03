"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState<{name: string, role: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then(r => r.json())
      .then(d => {
        if (d.user) setUser(d.user);
        setLoading(false);
      });
  }, []);

  async function handleSignOut() {
    // Safely call the server to destroy the session cookie
    await fetch("/api/signout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading || !user) {
    return (
      <header className="nav">
        <div className="nav-container">
          <Link href="/" className="brand">🦺 SafeConstruct</Link>
        </div>
      </header>
    );
  }

  return (
    <header className="nav">
      <div className="nav-container">
        <Link href="/" className="brand">🦺 SafeConstruct</Link>
        <nav style={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/analytics">Analytics</Link>
          <Link href="/network">Trust Graph</Link>
          <span style={{ color: "var(--border)", margin: "0 1rem" }}>|</span>
          <Link href="/issuer">Issuer Portal</Link>
          <Link href="/worker">Worker Wallet</Link>
          <Link href="/verify">Verify Site</Link>

          <div className="profile-container">
            <div className="profile-button">
              <span>👤</span> {user.name}
            </div>
            
            <div className="profile-dropdown-wrapper">
              <div className="profile-dropdown">
                <Link href="/profile" className="dropdown-item">
                  Edit Details
                </Link>
                <button onClick={handleSignOut} className="dropdown-item danger">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}