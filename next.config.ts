import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // IMPORTANT: `output: "standalone"` must stay OFF for Vercel.
  // With it enabled, Vercel's build output collector fails at
  // "Finalizing page optimization" with:
  //   ENOENT: no such file or directory, open '.next/next-server.js.nft.json'
  // Standalone is only for self-hosting (bun/node server.js).
  //
  // Reduce peak memory during `next build` — Vercel hobby builders have
  // 1 GB RAM and this large app (60+ routes) can OOM the builder.
  // cpus:1 serializes compile workers.
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
