"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

type Me = { id: string; email: string; name: string; role: string; address: string | null } | null;

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch(`/api/auth?t=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="hero" style={{ paddingTop: '10rem' }}>
        <span className="spinner" style={{ margin: '0 auto', display: 'block' }}></span>
      </div>
    );
  }

  if (!me) {
    return (
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        <style jsx global>{`
          @keyframes floatLogo {
            0% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-12px);
            }
            100% {
              transform: translateY(0px);
            }
          }

          @keyframes shineSweep {
            0% {
              left: -120%;
            }

            100% {
              left: 150%;
            }
          }
        `}</style>

        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -10,
            background: `
              radial-gradient(
                circle at ${50 + scrollY * 0.015}% ${15 + scrollY * 0.01}%,
                rgba(255,190,50,0.18),
                transparent 35%
              ),
              radial-gradient(
                circle at ${85 - scrollY * 0.02}% ${75 - scrollY * 0.01}%,
                rgba(255,80,80,0.12),
                transparent 45%
              ),
              radial-gradient(
                circle at 15% 80%,
                rgba(0,150,255,0.10),
                transparent 45%
              ),
              linear-gradient(
                180deg,
                #020817 0%,
                #031125 45%,
                #020817 100%
              )
            `,
            transition: "background 0.15s linear",
          }}
        />

        <div
          className="hero"
          style={{
            paddingBottom: "4rem",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "1000px",
              height: "1000px",
              left: "50%",
              top: "-300px",
              transform: "translateX(-50%)",
              background:
                "radial-gradient(circle, rgba(255,184,0,0.20), transparent 70%)",
              filter: "blur(70px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "2rem",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "inline-block",
                animation: "floatLogo 6s ease-in-out infinite",
                overflow: "hidden",
              }}
            >
              <Image
                src="/logo.png"
                alt="SafeConstruct Logo"
                width={340}
                height={340}
                priority
                style={{
                  filter:
                    "drop-shadow(0 0 20px rgba(255,184,0,.35)) drop-shadow(0 0 60px rgba(255,184,0,.15))",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: "-20%",
                  left: "-120%",
                  width: "80px",
                  height: "140%",
                  transform: "skewX(-25deg)",
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)",
                  pointerEvents: "none",
                  mixBlendMode: "screen",
                  animation: "shineSweep 5s linear infinite",
                }}
              />
            </div>
          </div>
          <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', lineHeight: '1.1' }}>
            The Standard for Verifiable Safety
          </h1>
          <p className="lead" style={{ maxWidth: '800px', margin: '0 auto', fontSize: '1.25rem' }}>
            SafeConstruct anchors construction compliance directly to the blockchain. We eliminate
            credential fraud, automate compliance, and ensure your workforce is mathematically
            verified for the site.
          </p>
          <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/login">
              <button style={{ padding: '1.2rem 2.5rem', fontSize: '1.1rem' }}>Log In</button>
            </Link>
            <Link href="/signup">
              <button className="ghost" style={{ padding: '1.2rem 2.5rem', fontSize: '1.1rem' }}>
                Sign Up
              </button>
            </Link>
          </div>
        </div>

        <div style={{ marginTop: '2rem', marginBottom: '6rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2rem' }}>
            Advanced Protocol Capabilities
          </h2>
          <div className="dashboard-layout" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
            <div className="card" style={{ padding: "2rem", backdropFilter: "blur(10px)", boxShadow: "0 0 40px rgba(255,184,0,.05)", border: "1px solid rgba(255,184,0,.12)", transition: "all .3s ease" }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⛓️</div>
              <h3 style={{ fontSize: '1.25rem' }}>Immutable Audit Trails</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Every issuance, expiration, and revocation is permanently recorded on-chain, creating
                a cryptographic ledger that prevents retroactive forgery.
              </p>
            </div>
            <div className="card" style={{ padding: "2rem", backdropFilter: "blur(10px)", boxShadow: "0 0 40px rgba(255,184,0,.05)", border: "1px solid rgba(255,184,0,.12)", transition: "all .3s ease" }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛡️</div>
              <h3 style={{ fontSize: '1.25rem' }}>Zero-Knowledge Verification</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Site Managers can validate a worker's safety clearance in real-time, relying entirely
                on mathematically proven hashes rather than physical paperwork.
              </p>
            </div>
            <div className="card" style={{ padding: "2rem", backdropFilter: "blur(10px)", boxShadow: "0 0 40px rgba(255,184,0,.05)", border: "1px solid rgba(255,184,0,.12)", transition: "all .3s ease" }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌐</div>
              <h3 style={{ fontSize: '1.25rem' }}>Decentralized Mobility</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.95rem' }}>
                Workers carry a unified, instantly verifiable portfolio of their safety certifications
                across varying sites and competing employers.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // LOGGED IN STATE
  return (
    <section
        style={{
          position: "relative",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -10,
            background: `
              radial-gradient(
                circle at ${50 + scrollY * 0.015}% ${15 + scrollY * 0.01}%,
                rgba(255,190,50,0.18),
                transparent 35%
              ),
              radial-gradient(
                circle at ${85 - scrollY * 0.02}% ${75 - scrollY * 0.01}%,
                rgba(255,80,80,0.12),
                transparent 45%
              ),
              linear-gradient(
                180deg,
                #020817,
                #031125,
                #020817
              )
            `,
          }}
        />
      <div className="hero" style={{ paddingBottom: '3rem' }}>
        <h1>Network Dashboard</h1>
        <p className="lead">
          Welcome back, <strong>{me.name}</strong>. Select a module to proceed.
        </p>
      </div>
      <div className="cards">
        <Link href="/issuer" className="card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏫</div>
          <h3>Issuer Portal</h3>
          <p>Secure dashboard for training providers to issue, manage, and instantly revoke credentials on-chain.</p>
        </Link>
        <Link href="/worker" className="card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👷</div>
          <h3>Worker Wallet</h3>
          <p>Your portable professional identity. Carry your verified safety history to any job site securely.</p>
        </Link>
        <Link href="/verify" className="card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</div>
          <h3>Live Verification</h3>
          <p>Site managers can query the blockchain to cryptographically confirm worker compliance instantly.</p>
        </Link>
      </div>
    </section>
  );
}