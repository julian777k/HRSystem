import type { NextConfig } from "next";

const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // output: "standalone" is for Docker/self-hosted only
  // Cloudflare uses @opennextjs/cloudflare adapter
  ...(isCloudflare ? {} : { output: "standalone" }),
  // Skip TS type-checking during CF builds — prisma-cloudflare.ts uses D1 types
  // that don't match PrismaClient. Regular `next build` still checks all types.
  ...(isCloudflare ? { typescript: { ignoreBuildErrors: true } } : {}),
  allowedDevOrigins: ["172.30.1.30"],
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    // Prisma must be external for OpenNext to patch the generated client
    "@prisma/client",
    ".prisma/client",
    // Node.js-only packages: only externalize for local (non-Cloudflare) builds
    // On Cloudflare, D1 is used — pg/better-sqlite3 are not needed and
    // cause esbuild resolution errors if included
    ...(isCloudflare ? [] : [
      "pg",
      "pg-cloudflare",
      "pg-pool",
      "pg-protocol",
      "@prisma/adapter-pg",
      "@prisma/adapter-better-sqlite3",
      "better-sqlite3",
    ]),
  ],
};

export default nextConfig;
