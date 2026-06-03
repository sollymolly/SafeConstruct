import "./globals.css";
import type { ReactNode } from "react";
import Navbar from "../components/navbar";

export const metadata = {
  title: "SafeConstruct | Enterprise Safety Credentials",
  description: "Portable, blockchain-verified safety credentials for modern construction sites.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}