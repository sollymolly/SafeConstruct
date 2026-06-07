// Seeds the Organization table from a list the platform owner controls.
//
// Run it with:  npm run db:seed -w @safeconstruct/web
// (which calls `prisma db seed` so web/.env is loaded for DATABASE_URL).
//
// Org definitions come from, in order of preference:
//   1. the SEED_ORGS_JSON env var (a JSON array), or
//   2. web/prisma/organizations.json
// Each entry: { "name": "...", "joinCode": "...", "adminEmail": "..." }.
// Upserts are keyed on joinCode, so re-running updates names/admins in place and
// is safe to run repeatedly. To add a company, add an entry and re-run.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));

function normalizeJoinCode(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

const ORG_TYPES = ["SCHOOL", "COMPANY", "ACCREDITOR"];
function normalizeType(raw) {
  const t = String(raw ?? "").trim().toUpperCase();
  return ORG_TYPES.includes(t) ? t : "COMPANY";
}

/** Global break-glass admins (ADMIN_EMAILS env) — never demoted by reconciliation. */
function globalAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Make User.role match the org's configured adminEmail. The app reads User.role,
 * not Organization.adminEmail, and the login path only ever PROMOTES to ADMIN —
 * it never demotes. So when an org's admin changes, the old admin would keep their
 * ADMIN role forever. This reconciles both directions for users whose PRIMARY org
 * is this one: promote the configured admin (and any global admins) already in the
 * org, and demote any stale ADMIN who is no longer entitled.
 */
async function reconcileOrgAdmin(org, adminEmail) {
  const entitled = [
    ...new Set([adminEmail, ...globalAdminEmails()].filter(Boolean)),
  ];
  if (entitled.length) {
    await prisma.user.updateMany({
      where: { organizationId: org.id, email: { in: entitled } },
      data: { role: "ADMIN" },
    });
  }
  const { count } = await prisma.user.updateMany({
    where: {
      organizationId: org.id,
      role: "ADMIN",
      ...(entitled.length ? { NOT: { email: { in: entitled } } } : {}),
    },
    data: { role: "WORKER" },
  });
  if (count > 0) {
    console.log(`  ↳ demoted ${count} stale admin(s) in ${org.name}`);
  }
}

function loadOrgDefs() {
  const fromEnv = process.env.SEED_ORGS_JSON;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch {
      throw new Error("SEED_ORGS_JSON is not valid JSON.");
    }
  }
  try {
    return JSON.parse(readFileSync(join(here, "organizations.json"), "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  const defs = loadOrgDefs();
  if (!Array.isArray(defs) || defs.length === 0) {
    console.warn(
      "No organizations to seed. Create prisma/organizations.json (see the .example) " +
        "or set SEED_ORGS_JSON."
    );
    return;
  }

  for (const def of defs) {
    const name = String(def.name ?? "").trim();
    // Accept either `joinCode` or `code` for convenience.
    const joinCode = normalizeJoinCode(def.joinCode ?? def.code);
    const type = normalizeType(def.type);
    const adminEmail = def.adminEmail
      ? String(def.adminEmail).trim().toLowerCase()
      : null;
    // For ACCREDITOR orgs: the single credential category they grant (e.g. "OSHA").
    const accreditationCategory = def.accreditationCategory
      ? String(def.accreditationCategory).trim().toUpperCase()
      : null;

    if (!name || !joinCode) {
      console.warn("Skipping invalid org entry (need name + joinCode):", def);
      continue;
    }

    const org = await prisma.organization.upsert({
      where: { joinCode },
      update: { name, type, adminEmail, accreditationCategory },
      create: { name, joinCode, type, adminEmail, accreditationCategory },
    });
    // Keep User.role in sync with the (possibly changed) adminEmail — the app
    // checks User.role, and login only promotes, so a changed admin needs this.
    await reconcileOrgAdmin(org, adminEmail);
    console.log(
      `✓ ${org.name} [${org.type}]  —  join code ${org.joinCode}  —  admin ${org.adminEmail ?? "(none)"}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
