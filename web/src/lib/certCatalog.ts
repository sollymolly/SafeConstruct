// The catalog of issuable certifications, grouped by accreditation CATEGORY.
//
// An ACCREDITOR org grants a single category (e.g. "OSHA", on
// Organization.accreditationCategory); an issuer accredited for that category may
// issue any cert listed under it. The issue form on /issuer shows a searchable
// dropdown of the certs in the issuer's accredited categories, and the issue API
// gates on the same mapping (src/app/api/credentials/route.ts).
//
// Edit this list to add or rename certifications. `code` is the credentialType
// committed on-chain; `name` is the human-readable title shown to people.

export type CertDef = {
  code: string; // credentialType (on-chain), e.g. "OSHA-30"
  name: string; // human-readable title, e.g. "OSHA 30-Hour Construction Safety"
  category: string; // accreditation category that gates it, e.g. "OSHA"
};

export const CERT_CATALOG: CertDef[] = [
  { code: "OSHA-10", name: "OSHA 10-Hour Construction Safety", category: "OSHA" },
  { code: "OSHA-30", name: "OSHA 30-Hour Construction Safety", category: "OSHA" },
  { code: "OSHA-HAZWOPER", name: "OSHA HAZWOPER 40-Hour", category: "OSHA" },
  { code: "OSHA-510", name: "OSHA 510 — Occupational Safety & Health Standards for Construction", category: "OSHA" },
  { code: "OSHA-500", name: "OSHA 500 — Trainer Course in Construction Safety", category: "OSHA" },
];

/** Categories are compared case-insensitively (and trimmed) everywhere. */
function norm(s: string): string {
  return s.trim().toUpperCase();
}

/** All distinct categories present in the catalog. */
export const CERT_CATEGORIES: string[] = [...new Set(CERT_CATALOG.map((c) => c.category))];

/** The catalog entries whose category is in `categories`. */
export function certsForCategories(categories: string[]): CertDef[] {
  const set = new Set(categories.map(norm));
  return CERT_CATALOG.filter((c) => set.has(norm(c.category)));
}

/** The category that gates a given credentialType code, or null if not catalogued. */
export function categoryForCode(code: string): string | null {
  const hit = CERT_CATALOG.find((c) => norm(c.code) === norm(code));
  return hit ? hit.category : null;
}

/** Look up a catalog entry by its credentialType code. */
export function certByCode(code: string): CertDef | null {
  return CERT_CATALOG.find((c) => norm(c.code) === norm(code)) ?? null;
}
