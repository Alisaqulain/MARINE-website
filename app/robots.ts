import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/auth-url";

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/checkout"] },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
