"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NAME_MIN = 2;
const NAME_MAX = 64;

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate each name part (2–64 chars) before touching the network.
    const first = firstName.trim();
    const last = lastName.trim();
    if (first.length < NAME_MIN || first.length > NAME_MAX) {
      return setError(`First name must be between ${NAME_MIN} and ${NAME_MAX} characters.`);
    }
    if (last.length < NAME_MIN || last.length > NAME_MAX) {
      return setError(`Last name must be between ${NAME_MIN} and ${NAME_MAX} characters.`);
    }
    const name = `${first} ${last}`;

    const code = orgCode.trim().toUpperCase();
    if (!code) return setError("Enter your organization's join code.");

    setBusy(true);

    // Confirm the code maps to a real organization before creating the account,
    // so a bad code fails here (with the company name as feedback) rather than
    // leaving an org-less login.
    const res = await fetch("/api/orgs/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const org = await res.json().catch(() => ({}));
    if (!res.ok || !org.name) {
      setBusy(false);
      return setError(org.error || "Unknown organization code.");
    }

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // organizationCode rides in user_metadata so the account is bound to its
        // org on first provisioning (server re-validates it, see provisionUser).
        data: { name, firstName: first, lastName: last, organizationCode: code },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    // If "Confirm email" is OFF, signUp returns a live session → go straight in.
    if (data.session) {
      router.replace("/");
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
          First Name
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jordan"
            minLength={NAME_MIN}
            maxLength={NAME_MAX}
            required
          />
        </label>
        <label>
          Last Name
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Smith"
            minLength={NAME_MIN}
            maxLength={NAME_MAX}
            required
          />
        </label>
        <label>
          Organization Code
          <input
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value)}
            placeholder="FAKE-7F3K"
            autoCapitalize="characters"
            style={{ textTransform: "uppercase" }}
            required
          />
          <small style={{ color: "var(--muted)", fontWeight: 400 }}>
            The code your company admin gave you. It ties this account to one organization.
          </small>
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
