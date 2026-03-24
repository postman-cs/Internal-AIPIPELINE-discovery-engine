import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable powered-by header (information disclosure)
  poweredByHeader: false,

  // Standalone output for Docker deployments
  output: "standalone",

  // Allow long-running server actions (cascade runs 11 AI agents sequentially)
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  // Vercel Pro: 15 min max for serverless functions
  maxDuration: 900,
  serverExternalPackages: ["@prisma/client"],

  // Security headers are set in middleware.ts (single source of truth)
  // Keeping only DNS prefetch here as it's non-security and a perf hint
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
      ],
    },
  ],
};

export default nextConfig;
