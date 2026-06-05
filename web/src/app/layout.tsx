import "./globals.css";
import type { ReactNode } from "react";
import Navbar from "../components/navbar";
import { AuthProvider } from "@/lib/auth-context";

export const metadata = {
  title: "SafeConstruct | Enterprise Safety Credentials",
  description: "Portable, blockchain-verified safety credentials for modern construction sites.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main className="container">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}