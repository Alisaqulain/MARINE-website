import type { NextConfig } from "next";

// Conservative security headers that cannot break third-party scripts (GA4, PayPal, Vapi):
// no full Content-Security-Policy and no HSTS here. Both are deployment decisions (see
// reports/MARINA_MUSE_PRODUCTION_DEPLOYMENT_CHECKLIST.md): HSTS belongs on the HTTPS proxy, and a
// script CSP needs an audit of every third-party origin first.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mongodb"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [{ source: "/shop", destination: "/retail", permanent: false }];
  },
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
