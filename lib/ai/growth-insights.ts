/**
 * Agent 3 analysis from first-party data: the shopper journey funnel (visit → add to cart → checkout → paid),
 * checkout/CRO findings, internal-linking suggestions and owner recommendations. Every recommendation says
 * what it is based on: "data" (measured), "estimate" (derived from measured data) or "ai" (Gemini).
 * Pure — no I/O — so it is covered by `npm run check:phase2`.
 */

export type Basis = "data" | "estimate" | "ai";
export type Recommendation = { area: "checkout" | "product" | "seo" | "leads" | "content"; text: string; basis: Basis };

const pct = (part: number, whole: number) => (whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : null);

export function journeyFunnel(c: { visitors: number; cartSessions: number; checkoutsStarted: number; paidOrders: number; enquiries: number; calls: number; quotes: number }) {
  return {
    ...c,
    visitToCart: pct(c.cartSessions, c.visitors),
    cartToCheckout: pct(c.checkoutsStarted, c.cartSessions),
    checkoutToPaid: pct(c.paidOrders, c.checkoutsStarted),
    /** Started checkouts that did not end in a paid order. */
    checkoutAbandonment: c.checkoutsStarted > 0 ? Number((100 - (c.paidOrders / c.checkoutsStarted) * 100).toFixed(1)) : null,
  };
}

export type ProductActivity = { slug: string; name: string; category: string; views: number; carts: number; orders: number; inStock: boolean };

/**
 * Link from the most-viewed product pages to related products (same category) that get few views and are in stock.
 * Based on measured page views; it does not claim any ranking effect.
 */
export function internalLinkSuggestions(products: ProductActivity[], limit = 6) {
  const byCategory = new Map<string, ProductActivity[]>();
  for (const p of products) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  const top = [...products].filter((p) => p.views > 0).sort((a, b) => b.views - a.views).slice(0, 10);
  const out: { from: string; fromName: string; to: string; toName: string; reason: string }[] = [];
  const used = new Set<string>();
  for (const page of top) {
    const candidates = (byCategory.get(page.category) ?? [])
      .filter((p) => p.slug !== page.slug && p.inStock && !used.has(p.slug) && p.views < page.views / 4)
      .sort((a, b) => a.views - b.views)
      .slice(0, 1);
    for (const c of candidates) {
      used.add(c.slug);
      out.push({ from: page.slug, fromName: page.name, to: c.slug, toName: c.name, reason: `${page.views} views on "${page.name}" vs ${c.views} on "${c.name}" (same category)` });
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Products that are viewed but rarely added to cart — candidates for better photos, price or description. */
export function lowConversionProducts(products: ProductActivity[], minViews = 20) {
  return products
    .filter((p) => p.views >= minViews && p.carts / p.views < 0.02)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((p) => ({ slug: p.slug, name: p.name, views: p.views, carts: p.carts }));
}

export function growthRecommendations(input: {
  funnel: ReturnType<typeof journeyFunnel>;
  lowConversion: ReturnType<typeof lowConversionProducts>;
  links: ReturnType<typeof internalLinkSuggestions>;
  openHighValueLeads: number;
  searchConnected: boolean;
  analyticsConnected: boolean;
}): Recommendation[] {
  const out: Recommendation[] = [];
  const f = input.funnel;
  if (f.checkoutsStarted >= 3 && (f.checkoutAbandonment ?? 0) >= 50) {
    out.push({ area: "checkout", basis: "data", text: `${f.checkoutAbandonment}% of started checkouts (${f.checkoutsStarted}) did not complete payment. Check PayPal errors, shipping costs and trust signals on /checkout.` });
  }
  if (f.cartSessions >= 5 && (f.cartToCheckout ?? 0) < 30) {
    out.push({ area: "checkout", basis: "data", text: `Only ${f.cartToCheckout}% of shoppers who added to cart started checkout. Make the bag's checkout button and delivery estimate more prominent.` });
  }
  if (f.visitors >= 100 && (f.visitToCart ?? 0) < 2) {
    out.push({ area: "product", basis: "data", text: `Visit-to-cart is ${f.visitToCart}%. Review product page photos, prices and the add-to-cart button above the fold.` });
  }
  for (const p of input.lowConversion.slice(0, 3)) {
    out.push({ area: "product", basis: "data", text: `"${p.name}" had ${p.views} views but ${p.carts} add-to-cart(s). Improve its photos, description or price.` });
  }
  for (const l of input.links.slice(0, 3)) {
    out.push({ area: "seo", basis: "estimate", text: `Add an internal link from "${l.fromName}" to "${l.toName}" (${l.reason}). Expected benefit is an estimate, not measured.` });
  }
  if (input.openHighValueLeads) out.push({ area: "leads", basis: "data", text: `${input.openHighValueLeads} high-value lead(s) are open — follow up today.` });
  if (!input.searchConnected) out.push({ area: "seo", basis: "data", text: "Search Console is not connected, so keyword and ranking recommendations are unavailable." });
  if (!input.analyticsConnected) out.push({ area: "content", basis: "data", text: "GA4 is not connected; landing-page recommendations use first-party page views only." });
  return out;
}
