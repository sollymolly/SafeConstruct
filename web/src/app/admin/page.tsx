"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  address: string | null;
  createdAt: string;
  orgName: string | null;
  accredited: boolean;
  accreditorName: string | null;
};

type SortKey = "name" | "joined";

export default function AdminPage() {
  const [role, setRole] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [accreditor, setAccreditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [accreditingId, setAccreditingId] = useState<string | null>(null);
  const [accreditorName, setAccreditorName] = useState("");

  async function load() {
    const me = await fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => d.user)
      .catch(() => null);
    setRole(me?.role ?? null);
    if (me?.role === "ADMIN") {
      const d = await fetch("/api/admin/users")
        .then((r) => r.json())
        .catch(() => ({ users: [] }));
      setUsers(d.users ?? []);
      setAccreditor(Boolean(d.viewerIsAccreditor));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(id: string, next: string) {
    setBusyId(id);
    setError("");
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    const d = await r.json();
    setBusyId(null);
    if (d.error) return setError(d.error);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: next } : u)));
  }

  async function accredit(id: string, name: string) {
    setBusyId(id);
    setError("");
    const r = await fetch("/api/admin/accredit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id, accreditorName: name }),
    });
    const d = await r.json();
    setBusyId(null);
    if (d.error) return setError(d.error);
    setAccreditingId(null);
    setAccreditorName("");
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, accredited: true, accreditorName: d.accreditorName } : u)),
    );
  }

  async function revokeAccred(id: string) {
    setBusyId(id);
    setError("");
    const r = await fetch("/api/admin/accredit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id, revoke: true }),
    });
    const d = await r.json();
    setBusyId(null);
    if (d.error) return setError(d.error);
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, accredited: false, accreditorName: null } : u)),
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = (
    q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        )
      : users
  )
    .slice()
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        : // Newest first by join date.
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  if (loading) return null;

  if (role !== "ADMIN") {
    return (
      <section className="auth-container">
        <h1>Admins only</h1>
        <p className="lead">You need an admin account to manage user roles.</p>
        <Link href="/" className="card" style={{ display: "block" }}>
          Back home →
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div className="search-header">
        <h1>{accreditor ? "Accreditation" : "User Administration"}</h1>
        <p className="lead">
          {accreditor
            ? "Accredit training-provider issuers so verifiers can trust who issued a credential. Revoke accreditation at any time."
            : "Grant or revoke issuer access. New sign-ups are workers by default — only issuers can mint on-chain credentials."}
        </p>
      </div>

      {error && <p className="msg error">{error}</p>}

      {users.length > 0 && (
        <div className="admin-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search employees by name or email"
          />
          <select
            className="admin-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort employees"
          >
            <option value="name">Sort: A–Z</option>
            <option value="joined">Sort: Recently joined</option>
          </select>
          <span className="admin-search-count">
            {filtered.length} of {users.length}
          </span>
        </div>
      )}

      {users.length === 0 ? (
        <div className="empty-state">
          <h3>{accreditor ? "No training-provider issuers yet" : "No users yet"}</h3>
          <p>
            {accreditor
              ? "Once a school promotes someone to issuer, they appear here to accredit."
              : "Accounts appear here as people sign up."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No matches</h3>
          <p>No employees match &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <ul className="list">
          {filtered.map((u) => (
            <li key={u.id} className="card row between">
              <div className="list-item-content">
                <strong style={{ fontSize: "1.1rem" }}>{u.name}</strong>
                <small>
                  {u.email}
                  {accreditor
                    ? u.orgName
                      ? ` • ${u.orgName}`
                      : ""
                    : u.address
                      ? ` • ${u.address.slice(0, 6)}…${u.address.slice(-4)}`
                      : " • no wallet"}
                </small>
              </div>
              <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end", gap: "0.6rem" }}>
                {/* Accreditation status badge — shown for any issuing account. */}
                {(u.role === "ISSUER" || (accreditor && u.role === "ADMIN")) && (
                  <span
                    className={`badge ${u.accredited ? "ok" : ""}`}
                    title={u.accredited ? `Accredited by ${u.accreditorName}` : "Not accredited by a recognized body"}
                    style={
                      u.accredited
                        ? undefined
                        : { background: "var(--panel-2)", color: "var(--muted)", border: "1px solid var(--border)" }
                    }
                  >
                    {u.accredited ? `✓ ${u.accreditorName}` : "Unaccredited"}
                  </span>
                )}

                {/* Role badge — only meaningful in the own-org management view. */}
                {!accreditor && (
                  <span
                    className={`badge ${u.role === "ISSUER" ? "ok" : u.role === "ADMIN" ? "warn" : ""}`}
                    style={
                      u.role === "WORKER"
                        ? {
                            background: "var(--panel-2)",
                            color: "var(--muted)",
                            border: "1px solid var(--border)",
                          }
                        : undefined
                    }
                  >
                    {u.role}
                  </span>
                )}

                {/* Own-org admins manage roles; they do NOT accredit. */}
                {!accreditor && u.role === "WORKER" && (
                  <button onClick={() => changeRole(u.id, "ISSUER")} disabled={busyId === u.id}>
                    {busyId === u.id ? <span className="spinner"></span> : "Make Issuer"}
                  </button>
                )}
                {!accreditor && u.role === "ISSUER" && (
                  <button className="ghost" onClick={() => changeRole(u.id, "WORKER")} disabled={busyId === u.id}>
                    {busyId === u.id ? "…" : "Revoke Issuer"}
                  </button>
                )}

                {/* Accreditor admins vouch for (or revoke) school issuers. */}
                {accreditor && accreditingId === u.id ? (
                  <>
                    <input
                      value={accreditorName}
                      onChange={(e) => setAccreditorName(e.target.value)}
                      placeholder="Accrediting body (e.g. OSHA)"
                      style={{ width: "210px" }}
                    />
                    <button onClick={() => accredit(u.id, accreditorName)} disabled={busyId === u.id || !accreditorName.trim()}>
                      {busyId === u.id ? <span className="spinner"></span> : "Save"}
                    </button>
                    <button
                      className="ghost"
                      style={{ color: "var(--text)", borderColor: "var(--border)" }}
                      onClick={() => {
                        setAccreditingId(null);
                        setAccreditorName("");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  accreditor && (
                    <>
                      <button
                        onClick={() => {
                          setAccreditingId(u.id);
                          setAccreditorName(u.accreditorName ?? "");
                        }}
                        disabled={busyId === u.id}
                      >
                        {u.accredited ? "Re-accredit" : "Accredit"}
                      </button>
                      {u.accredited && (
                        <button className="ghost" onClick={() => revokeAccred(u.id)} disabled={busyId === u.id}>
                          Revoke Accred.
                        </button>
                      )}
                    </>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
