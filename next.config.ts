import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongodb"],
  images: {
    qualities: [75, 95],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "marinamuseinternational.com" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
