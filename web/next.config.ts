import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma ships native query engine binaries; keep it as an external server
  // package so Next doesn't try to bundle it into serverless output.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
