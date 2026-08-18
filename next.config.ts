import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Turbopack's on-disk cache can invalidate itself on Windows and force a
  // full page reload of every open tab. Keep compile results in memory only.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
