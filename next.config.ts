import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  experimental: {
    turbo: {
      rules: {},
    },
  },
};

export default nextConfig;
