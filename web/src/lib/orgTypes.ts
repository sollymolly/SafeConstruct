// Organization types gate which features an org's members see. The trust chain
// is: ACCREDITOR accredits SCHOOL → SCHOOL issues to worker → COMPANY verifies.
export type OrgType = "SCHOOL" | "COMPANY" | "ACCREDITOR";

// Legacy/unseeded orgs (null type) behave like a SCHOOL so existing issuing
// flows keep working until the org table is re-seeded with explicit types.
function t(type: string | null | undefined): OrgType {
  return type === "COMPANY" || type === "ACCREDITOR" ? type : "SCHOOL";
}

/** Schools (training providers) are the only orgs that mint credentials. */
export function orgCanIssue(type: string | null | undefined): boolean {
  return t(type) === "SCHOOL";
}

/** Construction companies verify incoming workers. */
export function orgCanVerify(type: string | null | undefined): boolean {
  return t(type) === "COMPANY";
}

/** Only recognized accreditation bodies may accredit issuers. */
export function orgCanAccredit(type: string | null | undefined): boolean {
  return t(type) === "ACCREDITOR";
}

/** Issuance analytics + trust graph belong to schools (they issue). */
export function orgHasAnalytics(type: string | null | undefined): boolean {
  return t(type) === "SCHOOL";
}

/**
 * Whether members of this org hold credentials (and so get a Worker Wallet).
 * Accreditation bodies are institutions, not credential holders.
 */
export function orgHasWorkerWallet(type: string | null | undefined): boolean {
  return t(type) !== "ACCREDITOR";
}

export function orgTypeLabel(type: string | null | undefined): string {
  return { SCHOOL: "Training Provider", COMPANY: "Construction Company", ACCREDITOR: "Accreditation Body" }[t(type)];
}
