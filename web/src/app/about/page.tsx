import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "About SafeConstruct | Technical Whitepaper",
  description:
    "What SafeConstruct is, how its blockchain credentialing works, and who it serves.",
};

export default function AboutPage() {
  return (
    <section className="paper-wrap">
      <Link href="/" className="paper-back">
        ← Back to SafeConstruct
      </Link>

      <article className="paper">
        <header className="paper-head">
          <div className="paper-venue">SafeConstruct Technical Whitepaper · v0.1</div>
          <h1 className="paper-title">
            SafeConstruct: Blockchain-Anchored Safety Credentials for the Modern
            Construction Workforce
          </h1>
          <div className="paper-authors">
            <span>
              Jaden Cutinha<sup>1</sup>
            </span>
            <span>
              Sol Park<sup>1</sup>
            </span>
          </div>
          <div className="paper-affil">
            <sup>1</sup>Founder &amp; Core Contributor, SafeConstruct
          </div>
          <div className="paper-date">June 2026</div>
        </header>

        <div className="paper-abstract">
          <h2>Abstract</h2>
          <p>
            Construction safety credentials are today scattered across paper cards,
            PDFs, and siloed employer databases, making them slow to verify and
            trivial to forge. SafeConstruct re-anchors every credential to a public
            blockchain: the full record lives off-chain, while a cryptographic hash
            of it is committed on-chain, where it cannot be altered or back-dated.
            Verification becomes a deterministic comparison — re-hash the record,
            check it against the chain — rather than a phone call. This document
            describes the system, its on-chain mechanics, and the value it delivers
            to workers, training providers, and site managers.
          </p>
        </div>

        <div className="paper-section">
          <h2>1. Introduction</h2>
          <p>
            The construction industry depends on trust. Before stepping onto a job site, 
            workers must demonstrate that they have completed the training and certifications
            required to perform their work safely. Yet credential management remains fragmented
            across paper cards, PDFs, emails, and isolated employer databases. As workers move between
            employers and projects, proving compliance becomes slow, expensive, and prone to error.
            These inefficiencies create real risks. Site managers often spend valuable time manually 
            verifying credentials, workers are frequently required to repeat training simply because 
            records cannot be located, and fraudulent or expired certifications can go undetected. 
            The absence of a shared, verifiable credential standard limits workforce mobility and 
            increases administrative overhead across the industry. SafeConstruct was created to address
            this problem. Our platform provides a portable, tamper-evident credential layer that allows
            workers, training providers, and employers to securely issue, manage, and verify safety
            certifications. By combining modern cryptography with blockchain-based verification,
            SafeConstruct transforms safety credentials from isolated documents into trusted digital
            assets that can be instantly validated anywhere they are needed.

          </p>
        </div>

        <div className="paper-section">
          <h2>2. System Overview</h2>
          <p>
            SafeConstruct separates a credential&apos;s <em>content</em> from its{" "}
            <em>proof</em>. Human-readable details — the worker, the issuing
            organization, the course, issue and expiry dates — are stored off-chain
            in an encrypted database. A single cryptographic fingerprint of that exact
            record is committed to a smart contract,{" "}
            <span className="paper-mono">CredentialRegistry</span>, deployed to an
            EVM-compatible chain. Because the fingerprint is derived deterministically
            from the record, any later edit to the off-chain data produces a different
            fingerprint and is immediately detectable.
          </p>
        </div>

        <div className="paper-section">
          <h2>3. Blockchain Functionality</h2>

          <h3>3.1 On-Chain Credential Anchoring</h3>
          <p>
            When a credential is issued, its canonical record is serialized in a fixed
            field order and hashed with{" "}
            <span className="paper-mono">keccak256</span> to produce a 32-byte{" "}
            <span className="paper-mono">dataHash</span>. The issuer&apos;s wallet
            submits this hash, the worker&apos;s address, the credential type, and an
            expiry timestamp to the registry, which records them immutably and emits
            an issuance event. The chain therefore holds a permanent, ordered ledger
            of every credential ever minted.
          </p>

          <h3>3.2 Cryptographic Verification</h3>
          <p>
            To verify, SafeConstruct re-derives the hash from the current off-chain
            record and reads the on-chain entry via the chain&apos;s RPC. The result
            resolves to one of several states:{" "}
            <span className="paper-mono">VERIFIED</span> when the hashes match and the
            credential is live; <span className="paper-mono">TAMPERED</span> when the
            off-chain record no longer matches its on-chain commitment;{" "}
            <span className="paper-mono">REVOKED</span>,{" "}
            <span className="paper-mono">EXPIRED</span>, or{" "}
            <span className="paper-mono">NOT_FOUND</span> otherwise. No trusted
            intermediary is required — the proof is mathematical.
          </p>

          <h3>3.3 Custodial Wallets &amp; Role-Based Access</h3>
          <p>
            So that non-crypto users are never blocked by seed phrases, SafeConstruct
            provisions a custodial wallet per account, with private keys encrypted at
            rest using authenticated AES-256-GCM. On-chain authority is governed by
            roles: only addresses holding the issuer role may mint or revoke, enforced
            by the contract itself rather than by application code alone.
          </p>

          <h3>3.4 Revocation, Expiry &amp; Status</h3>
          <p>
            Credentials can be revoked by their original issuer or an administrator,
            and may carry an expiry timestamp after which they cease to be valid. The
            chain is the source of truth for status, so a revocation is globally
            visible the moment it is confirmed — there is no stale cache to clear at
            the gate.
          </p>
        </div>

        <div className="paper-section">
          <h2>4. Who SafeConstruct Serves</h2>
          <ul>
            <li>
              <strong>Workers</strong> carry a portable, verifiable portfolio of their
              safety certifications that follows them across employers and sites.
            </li>
            <li>
              <strong>Issuers</strong> (training providers and certifying bodies) mint
              credentials that cannot be forged and can be revoked instantly if a
              certification is withdrawn.
            </li>
            <li>
              <strong>Site managers</strong> confirm a worker&apos;s clearance in real
              time against the chain, replacing paperwork and phone calls with a
              cryptographic check.
            </li>
          </ul>
        </div>

        <div className="paper-section">
          <h2>5. Conclusion</h2>
          <p>
            SafeConstruct represents a practical application of blockchain
            technology to a real operational challenge faced throughout the
            construction industry. Rather than replacing existing training providers
            or compliance processes, the platform strengthens them by creating a shared 
            source of trust for credential verification. By anchoring credential integrity 
            to a public blockchain while keeping sensitive information securely stored off-chain, 
            SafeConstruct enables workers to carry their qualifications across employers, 
            allows issuers to maintain control over certification lifecycles, and gives site 
            managers immediate confidence in workforce compliance. As the industry continues 
            to modernize, portable and verifiable safety credentials have the potential to 
            become foundational infrastructure for a safer, more efficient, and more connected 
            construction workforce.

          </p>
        </div>

        <div className="paper-bios">
          <h2>About the Authors</h2>
          <div className="bio-grid">
            <div className="bio">
              <Image
                src="/1735506656976.jpeg"
                alt="Photo of Jaden Cutinha"
                width={128}
                height={128}
                className="bio-photo"
              />
              <h3>Jaden Cutinha</h3>
              <div className="bio-role">Co-Founder</div>
              <p>
                Jaden focuses on the protocol and product behind SafeConstruct. 
                Jaden is a sophomore at Princeton studying Computer Science and Quantitative Economics.
              </p>
            </div>
            <div className="bio">
              <Image
                src="/1751746147623.jpeg"
                alt="Photo of Sol Park (placeholder)"
                width={128}
                height={128}
                className="bio-photo"
              />
              <h3>Sol Park</h3>
              <div className="bio-role">Co-Founder</div>
              <p>
                  Sol focuses on the experience and systems behind SafeConstruct.
                  Sol is a sophomore at Princeton studying Computer Science and Philosophy.
              </p>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
