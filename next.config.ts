import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    domains: [],
    unoptimized: false,
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
