import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname, "../../"),
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "@tanstack/react-query",
      "dayjs",
    ],
    proxyTimeout: 120_000,
  },
  transpilePackages: ["@jobby/ui"],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      path.resolve(__dirname, "../../node_modules"),
      path.resolve(__dirname, "../../packages/ui/node_modules"),
    ];
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  allowedDevOrigins: [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3002",
    "http://localhost:3002",
    "http://127.0.0.1:3010",
    "http://localhost:3010",
  ],
  async rewrites() {
    const apiBaseUrl =
      process.env.API_INTERNAL_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiBaseUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
