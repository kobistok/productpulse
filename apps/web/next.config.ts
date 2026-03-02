import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Ensures Next.js file tracing reaches packages/ in the monorepo
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@productpulse/db", "@productpulse/agent"],
};

export default nextConfig;
