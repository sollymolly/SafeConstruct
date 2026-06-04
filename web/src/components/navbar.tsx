"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function Navbar() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    fetch(`/api/auth?t=${Date.now()}`)
      .then(r => r.json())
      .then(d => { setUser(d.user ?? null); setLoading(false); })
      .catch(() => setLoading(false)); 

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetch(`/api/auth?t=${Date.now()}`)
        .then(r => r.json())
        .then(d => { setUser(d.user ?? null); setLoading(false); })
        .catch(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();          
    await fetch("/auth/signout", { method: "POST" }); 
    await fetch("/api/signout", { method: "POST" });  
    window.location.replace("/");
  }

  if (loading || !user) {
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
        </div>
      </header>
    );
  }

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
          <Link href="/issuer">Issuer Portal</Link>
          <Link href="/worker">Worker Wallet</Link>
          <Link href="/verify">Verify Site</Link>

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