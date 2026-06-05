"use client";

import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { canIssue, isAdmin } from "@/lib/roles";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";

export default function Navbar() {
  const { user, loading, transitioning, setTransitioning } = useAuth();

  async function handleSignOut() {
    // Hide the nav for the whole sign-out → redirect window so we never flash the
    // logged-out "About Us" bar on the current page before the reload.
    setTransitioning(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/auth/signout", { method: "POST" });
    await fetch("/api/signout", { method: "POST" });
    window.location.replace("/");
  }

  // While auth is resolving or a redirect is mid-flight, render a bare bar (brand
  // only) so the right side appears in sync with the destination page.
  if (loading || transitioning) {
    return (
      <header className="nav">
        <div className="nav-container">
          <Link href="/" className="brand">
            <Image src="/logo.png" alt="SafeConstruct Logo" width={60} height={60} />
            <span>SafeConstruct</span>
          </Link>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className="nav">
        <div className="nav-container">
          <Link href="/" className="brand">
            <Image
              src="/logo.png"
              alt="SafeConstruct Logo"
              width={60}
              height={60}
            />
            <span>SafeConstruct</span>
          </Link>
          <nav style={{ display: "flex", alignItems: "center" }}>
            <Link
              href="/about"
              style={{
                border: "1px solid var(--border)",
                padding: "0.55rem 1.2rem",
                borderRadius: "999px",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: "0.9rem",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              About Us
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  const canIssueOrVerify = canIssue(user.role);
  const admin = isAdmin(user.role);

  return (
    <header className="nav">
      <div className="nav-container">
        <Link href="/" className="brand">
        <Image
          src="/logo.png"
          alt="SafeConstruct Logo"
          width={60}
          height={60}
        />
        <span>SafeConstruct</span>
      </Link>
        <nav style={{ display: "flex", alignItems: "center" }}>
          <Link href="/analytics">Analytics</Link>
          <Link href="/network">Trust Graph</Link>
          <span style={{ color: "var(--border)", margin: "0 1rem" }}>|</span>
          {/* Issuing and site-verification are issuer/admin tools — workers don't
              need them (the issuing API is role-gated server-side anyway). */}
          {canIssueOrVerify && <Link href="/issuer">Issuer Portal</Link>}
          <Link href="/worker">Worker Wallet</Link>
          {canIssueOrVerify && <Link href="/verify">Verify Site</Link>}
          {admin && <Link href="/admin">Admin</Link>}

          <div className="profile-container">
            <div className="profile-button">
              <Image
                src="/363633-200.png"
                alt="Profile"
                width={40}
                height={40}
                className="profile-icon"
              />
            </div>
            <div className="profile-dropdown-wrapper">
              <div className="profile-dropdown">
                <Link
                  href="/profile"
                  className="dropdown-item"
                  style={{ display: "flex", alignItems: "center", width: "100%", boxSizing: "border-box" }}
                >
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