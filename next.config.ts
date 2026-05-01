import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk", "@modelcontextprotocol/sdk"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
