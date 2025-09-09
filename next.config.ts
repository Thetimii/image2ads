import type { NextConfig } from "next";
import path from "path";

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
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
