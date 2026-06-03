"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }

    const redirect = new URLSearchParams(window.location.search).get("redirect");
    if (redirect) {
      router.replace(redirect);
    } else {
      const me = await fetch("/api/auth")
        .then((r) => r.json())
        .then((d) => d.user)
        .catch(() => null);
      const dest =
        me?.role === "ISSUER" ? "/issuer" : me?.role === "ADMIN" ? "/admin" : "/worker";
      router.replace(dest);
    }
    router.refresh();
  }

  return (
    <section className="auth-container">
      <h1>Log in</h1>
      <p className="lead">Welcome back. Access your credentials and dashboards.</p>
      <form onSubmit={login} className="card form">
        <label>
          Email Address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button disabled={busy}>
          {busy ? <span className="spinner"></span> : "Log in"}
        </button>
        {error && <p className="msg error">{error}</p>}
      </form>
      <p className="lead" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
        Need an account?{" "}
        <Link href="/signup" style={{ color: "var(--brand)", fontWeight: 600 }}>
          Sign up
        </Link>
      </p>
    </section>
  );
}
