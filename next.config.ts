import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // HACKATHON MODE: Skip all checks in dev, Vercel will catch errors
  typescript: {
    ignoreBuildErrors: isDev,
  },
  eslint: {
    ignoreDuringBuilds: isDev,
  },

  images: {
    remotePatterns: [
      // Supabase Storage - Public buckets
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      // Supabase Storage - signed URLs (private buckets)
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/sign/**",
      },
      // Supabase Storage - authenticated URLs (private buckets)
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/authenticated/**",
      },
      // AI Image Generation - Temporary files from aiquickdraw.com
      {
        protocol: "https",
        hostname: "tempfile.aiquickdraw.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // Configure Server Actions to allow larger file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },

  // Reduce dev server logging noise
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
