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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cqnaooicfxqtnbuwsopu.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: false,
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
