import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "SafeConstruct | Enterprise Safety Credentials",
  description: "Portable, blockchain-verified safety credentials for modern construction sites.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <header className="nav">
          <div className="nav-container">
            <Link href="/" className="brand">
              🦺 SafeConstruct
            </Link>
            <nav>
              <Link href="/analytics">Analytics</Link>
              <Link href="/network">Trust Graph</Link>
              <span style={{ color: "var(--border)", margin: "0 1rem" }}>|</span>
              <Link href="/issuer">Issuer Portal</Link>
              <Link href="/worker">Worker Wallet</Link>
              <Link href="/verify">Verify Site</Link>
              <span style={{ color: "var(--border)", margin: "0 1rem" }}>|</span>
              {user ? (
                <>
                  {user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
                  <span className="who" style={{ marginLeft: "1rem" }}>{user.name}</span>
                  <form action="/auth/signout" method="post" style={{ display: "inline" }}>
                    <button
                      type="submit"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--muted)",
                        marginLeft: "1rem",
                        padding: 0,
                        fontWeight: 500,
                        fontSize: "0.95rem",
                        cursor: "pointer",
                      }}
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login">Log in</Link>
                  <Link href="/signup">Sign up</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
