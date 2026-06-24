import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@base-ui/react'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
