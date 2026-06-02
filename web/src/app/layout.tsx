import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "SafeConstruct",
  description: "Portable, blockchain-based safety credentials for construction workers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <Link href="/" className="brand">
            🦺 SafeConstruct
          </Link>
          <nav>
            <Link href="/issuer">Issuer</Link>
            <Link href="/worker">Worker</Link>
            <Link href="/verify">Verify</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
