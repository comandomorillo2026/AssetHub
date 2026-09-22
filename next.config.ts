import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Reduce peak memory during `next build` — Vercel hobby builders have
  // 1 GB RAM and this large app (60+ routes) was OOM-killing the builder
  // (all Git-connected deployments failed since Aug 2026 while local
  // builds passed). cpus:1 serializes compile workers.
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
