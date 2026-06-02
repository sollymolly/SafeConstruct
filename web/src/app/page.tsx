import Link from "next/link";

export default function Home() {
  return (
    <section>
      <div className="hero">
        <h1>Tamper-proof safety credentials that travel with the worker.</h1>
        <p className="lead">
          SafeConstruct anchors every training certificate to the blockchain. Issuers mint
          credentials, workers carry them across employers, and site managers verify them in
          seconds — zero paperwork, zero forged cards.
        </p>
      </div>
      <div className="cards">
        <Link href="/issuer" className="card">
          <h3>🏫 Issuer Portal</h3>
          <p>Secure dashboard for training providers to issue, manage, and instantly revoke credentials on-chain.</p>
        </Link>
        <Link href="/worker" className="card">
          <h3>👷 Worker Wallet</h3>
          <p>Your portable professional identity. Carry your verified safety history to any job site securely.</p>
        </Link>
        <Link href="/verify" className="card">
          <h3>✅ Live Verification</h3>
          <p>Site managers can query the blockchain to cryptographically confirm worker compliance instantly.</p>
        </Link>
      </div>
    </section>
  );
}