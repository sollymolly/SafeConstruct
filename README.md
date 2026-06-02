# SafeConstruct

Portable, blockchain-based safety credential system for construction workers.
Workers carry verifiable training & certification records across employers,
enabling instant, tamper-proof job-site verification.

## How it works

The blockchain is the source of truth for **integrity & status**; the database
is the source of truth for **content**.

1. An authorized **issuer** issues a credential to a worker.
2. The full record (worker, course, dates, document) is stored **off-chain** in the DB.
3. A deterministic **hash** of that record + its metadata (issuer, type, expiry,
   status) is written **on-chain**.
4. A **verifier** re-hashes the off-chain record and compares it to the on-chain
   hash, then checks status/expiry. Match + valid = tamper-proof verification.

## Stack

| Layer       | Choice                                            |
| ----------- | ------------------------------------------------- |
| Chain       | Polygon (EVM), Solidity + Hardhat → Amoy testnet  |
| App         | Next.js (App Router), TypeScript                  |
| Chain client| viem                                              |
| Off-chain DB| Prisma + SQLite (dev) → Postgres (prod)           |
| Identity    | Custodial wallets behind email login              |

## Repo layout

```
contracts/   Hardhat project — Solidity smart contracts, tests, deploy
web/         Next.js fullstack app — UI + API + chain/db libraries
```

## Getting started

```bash
npm install                      # installs both workspaces

# Terminal 1 — local blockchain
npm run chain                    # starts a local Hardhat node

# Terminal 2 — deploy + run app
npm run contracts:deploy:local   # deploys contract, writes ABI/address into web/
npm run db:push                  # creates the local SQLite schema
npm run web:dev                  # starts Next.js at http://localhost:3000
```

See `.env.example` for required environment variables.
