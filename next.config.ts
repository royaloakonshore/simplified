import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react', '@tanstack/react-table'],
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Disable webpack-dev-server overlay
      config.devServer = {
        ...config.devServer,
        overlay: false,
      };
    }
    // Tree shaking improvements
    config.optimization.usedExports = true;
    config.optimization.sideEffects = false;
    return config;
  },
};

export default nextConfig;
