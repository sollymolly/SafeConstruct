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
};

type SortKey = "name" | "joined";

export default function AdminPage() {
  const [role, setRole] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

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
        <h1>User Administration</h1>
        <p className="lead">
          Grant or revoke issuer access. New sign-ups are workers by default — only issuers
          can mint on-chain credentials.
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
          <h3>No users yet</h3>
          <p>Accounts appear here as people sign up.</p>
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
                  {u.address ? ` • ${u.address.slice(0, 6)}…${u.address.slice(-4)}` : " • no wallet"}
                </small>
              </div>
              <div className="row">
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
                {u.role === "WORKER" && (
                  <button onClick={() => changeRole(u.id, "ISSUER")} disabled={busyId === u.id}>
                    {busyId === u.id ? <span className="spinner"></span> : "Make Issuer"}
                  </button>
                )}
                {u.role === "ISSUER" && (
                  <button
                    className="ghost"
                    onClick={() => changeRole(u.id, "WORKER")}
                    disabled={busyId === u.id}
                  >
                    {busyId === u.id ? "…" : "Revoke Issuer"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
