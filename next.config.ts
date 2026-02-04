import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: {
    proxyTimeout: 300_000, // 5 minutes for long-running generation API calls
  },
};

export default nextConfig;
