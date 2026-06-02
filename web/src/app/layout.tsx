import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "SafeConstruct | Enterprise Safety Credentials",
  description: "Portable, blockchain-verified safety credentials for modern construction sites.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <div className="nav-container">
            <Link href="/" className="brand">
              🦺 SafeConstruct
            </Link>
            <nav>
              <Link href="/issuer">Issuer Portal</Link>
              <Link href="/worker">Worker Wallet</Link>
              <Link href="/verify">Verify Site</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}