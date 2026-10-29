import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/auth-url";
import { getStorefrontProducts } from "@/lib/storefront-catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const staticPaths = ["", "/retail", "/wholesale", "/collections", "/about", "/contact", "/blog", "/shipping", "/returns", "/custom-manufacturing"];
  let products: { slug: string }[] = [];
  try {
    products = await getStorefrontProducts();
  } catch {
    products = [];
  }
  return [
    ...staticPaths.map((path) => ({ url: `${origin}${path || "/"}`, changeFrequency: "weekly" as const, priority: path ? 0.6 : 1 })),
    ...products.slice(0, 500).map((product) => ({
      url: `${origin}/product/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
