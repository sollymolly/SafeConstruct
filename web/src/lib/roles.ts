/**
 * Issuing credentials and running site verification are issuer/admin tools.
 * Admins are a superset of issuers: they can issue and revoke credentials AND
 * promote workers to issuer (see /admin). So everywhere we gate "can issue /
 * verify", admins pass too. Keeping this in one place stops the checks from
 * drifting apart across the navbar, the pages, and the API routes.
 */
export function canIssue(role: string | null | undefined): boolean {
  return role === "ISSUER" || role === "ADMIN";
}

/**
 * Only admins can manage user roles (the /admin page). Kept here alongside
 * canIssue so the navbar, the page guard, and the API route all agree.
 */
export function isAdmin(role: string | null | undefined): boolean {
  return role === "ADMIN";
}
