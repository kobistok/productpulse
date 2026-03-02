import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Ensures Next.js file tracing reaches packages/ in the monorepo
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Prisma engine binaries are not auto-detected by file tracing in pnpm monorepos
  outputFileTracingIncludes: {
    "**": ["../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node"],
  },
  transpilePackages: ["@productpulse/db", "@productpulse/agent"],
  // Don't bundle these — they use native binaries or ESM JSON that webpack can't handle
  serverExternalPackages: [
    "@prisma/client",
    ".prisma",
    "@google-cloud/tasks",
    "firebase-admin",
  ],
};

export default nextConfig;
