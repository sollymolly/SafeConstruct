"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    // If "Confirm email" is OFF, signUp returns a live session → go straight in.
    if (data.session) {
      router.replace("/worker");
      router.refresh();
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <section className="auth-container">
        <h1>Check your email</h1>
        <p className="lead">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          activate your account, then log in.
        </p>
        <Link href="/login" className="card" style={{ display: "block" }}>
          Go to log in →
        </Link>
      </section>
    );
  }

  return (
    <section className="auth-container">
      <h1>Create your account</h1>
      <p className="lead">
        Sign up to carry your verified safety credentials across every job site.
      </p>
      <form onSubmit={signUp} className="card form">
        <label>
          Full Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Smith"
            required
          />
        </label>
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
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>
        <button disabled={busy}>
          {busy ? <span className="spinner"></span> : "Create account"}
        </button>
        {error && <p className="msg error">{error}</p>}
      </form>
      <p className="lead" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
        New accounts start as workers — an admin grants issuer access separately.
        <br />
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--brand)", fontWeight: 600 }}>
          Log in
        </Link>
      </p>
    </section>
  );
}
