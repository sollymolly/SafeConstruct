import type { Prisma } from "@prisma/client";
import { hashCredential, toCredentialId } from "@/lib/hash";
import { getCredential } from "@/lib/chain/registry";
import type { CredentialRecord, VerificationStatus } from "@/types/credential";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * The set of credentials a given user is allowed to see, as a Prisma `where`.
 * Issuers see what they issued; workers see what they hold; admins see only the
 * credentials of workers within their OWN organization (no cross-org overlap).
 * A break-glass admin with no org is scoped to themselves rather than everyone.
 */
export function credentialScope(me: {
  id: string;
  role: string;
  organizationId: string | null;
}): Prisma.CredentialWhereInput {
  if (me.role === "ISSUER") return { issuerId: me.id };
  if (me.role === "WORKER") return { workerId: me.id };
  if (me.organizationId) return { worker: { organizationId: me.organizationId } };
  return { workerId: me.id };
}

export type CredentialWithParties = Prisma.CredentialGetPayload<{
  include: {
    worker: { include: { wallet: true } };
    issuer: { include: { wallet: true } };
  };
}>;

export const credentialInclude = {
  worker: { include: { wallet: true } },
  issuer: { include: { wallet: true } },
} as const;

export type ResolvedStatus = {
  status: VerificationStatus;
  onChain: boolean;
};

function expiresAtSec(c: CredentialWithParties): number {
  return c.expiresAt ? Math.floor(c.expiresAt.getTime() / 1000) : 0;
}

export function dbStatus(c: CredentialWithParties): VerificationStatus {
  const now = Math.floor(Date.now() / 1000);
  const exp = expiresAtSec(c);
  if (c.revokedAt) return "REVOKED";
  if (exp !== 0 && now > exp) return "EXPIRED";
  return "VERIFIED";
}

function statusFromChain(
  c: CredentialWithParties,
  onChain: Awaited<ReturnType<typeof getCredential>>
): VerificationStatus {
  const now = Math.floor(Date.now() / 1000);
  const exp = expiresAtSec(c);
  const record: CredentialRecord = {
    credentialId: c.id,
    workerAddress: c.worker.wallet?.address ?? ZERO,
    issuerAddress: c.issuer.wallet?.address ?? ZERO,
    issuerOrg: c.issuer.name,
    credentialType: c.credentialType,
    title: c.title,
    description: c.description ?? "",
    issuedAt: Math.floor(c.issuedAt.getTime() / 1000),
    expiresAt: exp,
  };
  const expected = hashCredential(record);
  if (!onChain.exists) return "NOT_FOUND";
  if (onChain.dataHash.toLowerCase() !== expected.toLowerCase()) return "TAMPERED";
  if (onChain.revoked) return "REVOKED";
  if (exp !== 0 && now > exp) return "EXPIRED";
  return "VERIFIED";
}

export async function resolveStatuses(
  creds: CredentialWithParties[]
): Promise<Map<string, ResolvedStatus>> {
  const map = new Map<string, ResolvedStatus>();
  if (creds.length === 0) return map;

  let chainUp = true;
  try {
    await getCredential(toCredentialId(creds[0].id));
  } catch {
    chainUp = false;
  }

  if (!chainUp) {
    for (const c of creds) map.set(c.id, { status: dbStatus(c), onChain: false });
    return map;
  }

  await Promise.all(
    creds.map(async (c) => {
      try {
        const onChain = await getCredential(toCredentialId(c.id));
        map.set(c.id, { status: statusFromChain(c, onChain), onChain: true });
      } catch {
        map.set(c.id, { status: dbStatus(c), onChain: false });
      }
    })
  );
  return map;
}

export function isCompromised(status: VerificationStatus): boolean {
  return status === "REVOKED" || status === "TAMPERED" || status === "NOT_FOUND";
}
