"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// A plain text/link-styled button (the global <button> is a filled amber pill,
// so we override it here for the inline "Forgot password?" / "Back" toggles).
const linkButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--brand)",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline",
  width: "auto",
  font: "inherit",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Toggles the form between normal login and the password-reset request.
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);

  function switchMode(next: "login" | "forgot") {
    setMode(next);
    setError("");
    setResetSent(false);
  }

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

    // Honor an explicit redirect (e.g. a protected page sent the user here),
    // otherwise land everyone on the home dashboard regardless of role.
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    window.location.replace(redirect || "/");
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    // The link lands on /auth/callback (which exchanges the code for a session)
    // and is then forwarded to /reset-password to choose a new password.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setResetSent(true);
  }

  // --- Password-reset request view ---------------------------------------
  if (mode === "forgot") {
    if (resetSent) {
      return (
        <section className="auth-container">
          <h1>Check your email</h1>
          <p className="lead">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a
            password reset link. Click it to choose a new password.
          </p>
          <p className="lead" style={{ fontSize: "0.9rem" }}>
            <button type="button" style={linkButton} onClick={() => switchMode("login")}>
              ← Back to log in
            </button>
          </p>
        </section>
      );
    }

    return (
      <section className="auth-container">
        <h1>Reset your password</h1>
        <p className="lead">
          Enter your account email and we&apos;ll send you a link to set a new password.
        </p>
        <form onSubmit={sendReset} className="card form">
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? <span className="spinner"></span> : "Send reset link"}
          </button>
          {error && <p className="msg error">{error}</p>}
        </form>
        <p className="lead" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Remembered it?{" "}
          <button type="button" style={linkButton} onClick={() => switchMode("login")}>
            Back to log in
          </button>
        </p>
      </section>
    );
  }

  // --- Login view --------------------------------------------------------
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
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          <div className="row between">
            <span>Password</span>
            <button type="button" style={{ ...linkButton, fontSize: "0.85rem" }} onClick={() => switchMode("forgot")}>
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
