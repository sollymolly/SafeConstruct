import Link from "next/link";

export default function Home() {
  return (
    <section>
      <h1>Tamper-proof safety credentials that travel with the worker.</h1>
      <p className="lead">
        SafeConstruct anchors every training certificate to the blockchain. Issuers mint
        credentials, workers carry them across employers, and site managers verify them in
        seconds — no phone calls, no forged paper cards.
      </p>
      <div className="cards">
        <Link href="/issuer" className="card">
          <h3>🏫 Issuer</h3>
          <p>Training providers issue and revoke credentials.</p>
        </Link>
        <Link href="/worker" className="card">
          <h3>👷 Worker</h3>
          <p>Carry your verified credentials anywhere.</p>
        </Link>
        <Link href="/verify" className="card">
          <h3>✅ Verify</h3>
          <p>Site managers confirm credentials instantly.</p>
        </Link>
      </div>
    </section>
  );
}
