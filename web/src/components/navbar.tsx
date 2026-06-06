"use client";

import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { canIssue, isAdmin } from "@/lib/roles";
import { orgCanIssue, orgCanVerify, orgHasAnalytics, orgHasWorkerWallet } from "@/lib/orgTypes";
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

  const admin = isAdmin(user.role);
  // Features depend on BOTH the user's role and what their org type is allowed
  // to do: schools issue, companies verify, accreditors accredit.
  const showIssuer = canIssue(user.role) && orgCanIssue(user.orgType);
  const showVerify = canIssue(user.role) && orgCanVerify(user.orgType);
  const showAnalytics = orgHasAnalytics(user.orgType);
  const showWallet = orgHasWorkerWallet(user.orgType);

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
          {/* Feature visibility is gated by org type (see lib/orgTypes) AND role;
              the underlying APIs enforce the same rules server-side. */}
          {showAnalytics && <Link href="/analytics">Analytics</Link>}
          {showAnalytics && <Link href="/network">Trust Graph</Link>}
          {showAnalytics && <span style={{ color: "var(--border)", margin: "0 1rem" }}>|</span>}
          {showIssuer && <Link href="/issuer">Issuer Portal</Link>}
          {showWallet && <Link href="/worker">Worker Wallet</Link>}
          {showVerify && <Link href="/verify">Verify Site</Link>}
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