import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads in dev. Without this, Next.js
// re-imports modules on every change and spawns a new connection pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
