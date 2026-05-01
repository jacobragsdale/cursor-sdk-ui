import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk", "@modelcontextprotocol/sdk", "global-agent", "undici"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
