"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Landing page for the password-reset email link. The link goes to
 * /auth/callback (which exchanges the one-time code for a recovery session and
 * sets the auth cookies), then forwards here. With that session in place we let
 * the user choose a new password via supabase.auth.updateUser.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // null = still checking, true/false = whether a valid recovery session exists.
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function update(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }
    if (password !== confirm) {
      return setError("Passwords do not match.");
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 2000);
  }

  if (ready === null) {
    return (
      <section className="auth-container">
        <span className="spinner" style={{ margin: "2rem auto", display: "block" }}></span>
      </section>
    );
  }

  if (!ready) {
    return (
      <section className="auth-container">
        <h1>Link expired</h1>
        <p className="lead">
          This password reset link is invalid or has already been used. Request a
          new one from the log in page.
        </p>
        <p className="lead" style={{ fontSize: "0.9rem" }}>
          <Link href="/login" style={{ color: "var(--brand)", fontWeight: 600 }}>
            ← Back to log in
          </Link>
        </p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="auth-container">
        <h1>Password updated</h1>
        <p className="lead">
          Your password has been changed. Redirecting you to log in&hellip;
        </p>
      </section>
    );
  }

  return (
    <section className="auth-container">
      <h1>Choose a new password</h1>
      <p className="lead">Enter a new password for your account below.</p>
      <form onSubmit={update} className="card form">
        <label>
          New Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm Password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your new password"
            minLength={8}
            required
          />
        </label>
        <button disabled={busy}>
          {busy ? <span className="spinner"></span> : "Update password"}
        </button>
        {error && <p className="msg error">{error}</p>}
      </form>
    </section>
  );
}
