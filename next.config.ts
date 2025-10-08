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
  // Generate new build ID on every build to prevent caching issues
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
};

export default nextConfig;
