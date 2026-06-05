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
    const adminEmail = def.adminEmail
      ? String(def.adminEmail).trim().toLowerCase()
      : null;

    if (!name || !joinCode) {
      console.warn("Skipping invalid org entry (need name + joinCode):", def);
      continue;
    }

    const org = await prisma.organization.upsert({
      where: { joinCode },
      update: { name, adminEmail },
      create: { name, joinCode, adminEmail },
    });
    console.log(
      `✓ ${org.name}  —  join code ${org.joinCode}  —  admin ${org.adminEmail ?? "(none)"}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
