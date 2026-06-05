# SafeConstruct — Auth & Supabase setup

SafeConstruct now uses **Supabase Auth** (email + password, email confirmation,
password reset, secure JWT sessions) and stores all off-chain data in **Supabase
Postgres**. Accounts sign up as **WORKER**; only an **ADMIN** can grant **ISSUER**
access (issuers are the only accounts that can mint on-chain credentials).

**Organizations.** Every account belongs to exactly one **organization** (a
construction company). Organizations are pre-seeded by the platform owner (see
step 4b) and joined with a **join code** entered on sign-up / log-in. An email is
scoped to a single org — an account created under one org cannot sign in against
another. Each org has one **ADMIN** (its configured `adminEmail`) who promotes its
own workers to issuer; admins only see their own org's members. A worker who
changes companies can switch orgs from their **/profile** page (their credentials
travel with them).

Follow these one-time steps to get a working environment.

## 1. Create a Supabase project
1. Go to <https://supabase.com> → **New project**. Pick a name, a strong database
   password (save it), and a region close to you.
2. Wait for it to finish provisioning (~2 min).

## 2. Copy credentials into `web/.env`
Open `web/.env` and replace the placeholders.

**Database** — Project → **Settings → Database → Connection string → "URI"**.
Supabase shows a *pooled* (Transaction, port `6543`) and a *direct* (Session, port
`5432`) string. Put your DB password in for `[YOUR-PASSWORD]`.
```
DATABASE_URL="postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres"
```

**Auth API keys** — Project → **Settings → API**.
```
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon public key>"
SUPABASE_SERVICE_ROLE_KEY="<service_role secret key>"   # server-only, never ships to the browser
```

**Global admin (break-glass)** — already set to your email; change if needed. Any
email listed here becomes ADMIN on first sign-in regardless of org. For normal
per-company admins, use the org's `adminEmail` instead (step 4b).
```
ADMIN_EMAILS="solpark0624@gmail.com"
```

Keep the existing `WALLET_ENCRYPTION_KEY`, `CHAIN_TARGET`, RPC, and
`RELAYER_PRIVATE_KEY` values as they are.

> For a real (non-demo) deployment, generate a fresh `WALLET_ENCRYPTION_KEY`:
> `node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))"`

## 3. Configure Supabase Auth
In the Supabase dashboard:
1. **Authentication → Providers → Email**: enable it, and turn **Confirm email** ON.
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: add `http://localhost:3000/auth/callback`
3. (Optional) The built-in mailer is rate-limited; for production set up SMTP under
   **Authentication → Emails**.

## 4. Create the database tables
From the repo root (this pushes the Prisma schema — including the `Organization`
table — to Supabase Postgres):
```
npm run db:push -w @safeconstruct/web
```

## 4b. Seed your organizations
Define your companies in `web/prisma/organizations.json` (copy
`organizations.example.json` to start). Each entry needs a display `name`, a
`joinCode` people will type to join, and the `adminEmail` that becomes that org's
ADMIN:
```json
[
  { "name": "Fake Construction", "joinCode": "FAKE-7F3K", "adminEmail": "you@example.com" }
]
```
Then load them into Postgres:
```
npm run db:seed -w @safeconstruct/web
```
Upserts are keyed on `joinCode`, so re-running is safe — to add a company later,
add an entry and re-run. (You can also add `Organization` rows directly in Supabase
studio.) A platform super-admin UI can manage these rows in-app later; this seed is
the "for now" path.

## 5. Run it
```
# 1. local chain + contract (existing flow)
npm run chain                 # terminal A — local Hardhat node
npm run contracts:deploy:local  # terminal B — deploy + write ABI/address into web

# 2. the app
npm run dev -w @safeconstruct/web   # http://localhost:3000
```

## 6. First run walkthrough
1. **Sign up** with the org's `adminEmail` address and that org's **join code** →
   check email → click the confirm link → you land logged in as **ADMIN** of that
   org (you'll see an **Admin** nav link).
2. Sign up a second account (any email) with the **same join code** → it's a
   **WORKER** in that org.
3. As admin, open **/admin** and click **Make Issuer** on one of your org's
   accounts (you only see your own org's members).
4. That issuer logs in (org code + email + password) → **/issuer** → mints a
   credential to a worker's email (the on-chain `ISSUER_ROLE` is granted
   automatically on the first mint). Issuing is scoped to your org.
5. The worker logs in → **/worker** → sees the credential as **VERIFIED**, with a
   QR code to present. **/verify** confirms any worker by email.
6. To move a worker to a different company: from **/profile**, enter the new org's
   join code under **Organization → Switch Organization**. (Logging in with the
   wrong org code is rejected — switching is the explicit, deliberate path.)

## How the pieces fit
- **Identity** lives in Supabase `auth.users`. Our Prisma `User` row links to it via
  `User.authId`. A worker can be issued a credential *before* signing up (a "shadow"
  profile); they **claim** it by email on first sign-in.
- **Organizations** are `Organization` rows; each `User` has an `organizationId`. The
  join code entered at sign-up is stored in Supabase `user_metadata` and bound to the
  account on first provisioning (`provisionUser`). Log-in calls `/api/auth/verify-org`
  to enforce that the entered code matches the account's org; switching orgs is the
  explicit `/api/auth/organization` action behind **/profile**. Admin and issuer API
  routes scope their queries to the caller's `organizationId`.
- **Sessions** are Supabase JWTs in httpOnly cookies, refreshed by
  `src/middleware.ts`. Logged-out users are bounced from `/issuer`, `/worker`,
  `/admin` to `/login`.
- **Authorization** is enforced server-side via `getCurrentUser().role` in every
  API route. All privileged DB access goes through Prisma (never the browser).
- **On-chain** holds only a keccak256 hash + credential type + wallet addresses +
  timestamps — no names or emails. Custodial wallet keys stay AES-256-GCM encrypted.
