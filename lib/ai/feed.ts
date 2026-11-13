export type FeedItem = {
  id: string;
  title: string;
  description: string;
  link: string;
  image: string;
  price: number;
  currency: "USD";
  availability: "in_stock" | "out_of_stock" | "preorder";
};

/** Google Merchant Center limits. */
const MAX_ID = 50;
const MAX_TITLE = 150;

/** Short stable hash (FNV-1a), so an id stays the same from one feed fetch to the next. */
function shortHash(value: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/**
 * One unique id per product, at most 50 characters: the SKU when it is unique, otherwise the slug,
 * shortened with a hash suffix when too long. A repeated SKU falls back to the slug-based id.
 */
export function feedIds(products: { sku?: string; slug: string }[]): string[] {
  const skuCount = new Map<string, number>();
  for (const p of products) if (p.sku?.trim()) skuCount.set(p.sku.trim(), (skuCount.get(p.sku.trim()) ?? 0) + 1);
  return products.map((p) => {
    const sku = p.sku?.trim() ?? "";
    if (sku && skuCount.get(sku) === 1 && sku.length <= MAX_ID) return sku;
    const suffix = `-${shortHash(p.slug)}`;
    return p.slug.length <= MAX_ID ? p.slug : `${p.slug.slice(0, MAX_ID - suffix.length).replace(/-+$/, "")}${suffix}`;
  });
}

/** Titles over 150 characters are disapproved; cut at the last whole word. */
export function feedTitle(title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_TITLE) return clean;
  const cut = clean.slice(0, MAX_TITLE);
  return cut.slice(0, cut.lastIndexOf(" ") > 100 ? cut.lastIndexOf(" ") : MAX_TITLE).replace(/[\s,–—-]+$/, "");
}

export function feedItemErrors(item: FeedItem): string[] {
  const errors: string[] = [];
  if (!item.id.trim()) errors.push("Missing id");
  if (item.id.length > MAX_ID) errors.push(`Id longer than ${MAX_ID} characters`);
  if (!item.title.trim()) errors.push("Missing title");
  if (!item.description.trim()) errors.push("Missing description");
  if (!/^https?:\/\//.test(item.link)) errors.push("Landing page must be an absolute URL");
  if (!/^https?:\/\//.test(item.image) && !item.image.startsWith("/")) errors.push("Image must be a URL or site path");
  if (!Number.isFinite(item.price) || item.price <= 0) errors.push("Price must be greater than 0");
  if (item.currency !== "USD") errors.push("Currency must be USD");
  if (!item.availability) errors.push("Missing availability");
  return errors;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Local feed document. This does not upload anything to Google. */
export function googleMerchantXml(items: FeedItem[], origin: string): { xml: string; errors: { id: string; errors: string[] }[] } {
  const errors: { id: string; errors: string[] }[] = [];
  const rows = items.flatMap((item) => {
    const itemErrors = feedItemErrors(item);
    if (itemErrors.length) {
      errors.push({ id: item.id || "(missing)", errors: itemErrors });
      return [];
    }
    const link = item.link.startsWith("http") ? item.link : `${origin}${item.link}`;
    const image = item.image.startsWith("http") ? item.image : `${origin}${item.image}`;
    return [
      `<item>`,
      `<g:id>${escapeXml(item.id)}</g:id>`,
      `<g:title>${escapeXml(feedTitle(item.title))}</g:title>`,
      `<g:description>${escapeXml(item.description.slice(0, 5000))}</g:description>`,
      `<g:link>${escapeXml(link)}</g:link>`,
      `<g:image_link>${escapeXml(image)}</g:image_link>`,
      `<g:price>${item.price.toFixed(2)} USD</g:price>`,
      `<g:availability>${item.availability}</g:availability>`,
      `<g:condition>new</g:condition>`,
      `<g:brand>Marina Muse International</g:brand>`,
      // Handmade, own-brand products have no GTIN; Google asks for identifier_exists=no in that case.
      `<g:identifier_exists>no</g:identifier_exists>`,
      `</item>`,
    ];
  });
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
    `<channel>`,
    `<title>Marina Muse International</title>`,
    `<link>${escapeXml(origin)}</link>`,
    ...rows,
    `</channel>`,
    `</rss>`,
  ].join("");
  return { xml, errors };
}
