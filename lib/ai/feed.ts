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

export function feedItemErrors(item: FeedItem): string[] {
  const errors: string[] = [];
  if (!item.id.trim()) errors.push("Missing id");
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
      `<g:title>${escapeXml(item.title)}</g:title>`,
      `<g:description>${escapeXml(item.description.slice(0, 5000))}</g:description>`,
      `<g:link>${escapeXml(link)}</g:link>`,
      `<g:image_link>${escapeXml(image)}</g:image_link>`,
      `<g:price>${item.price.toFixed(2)} USD</g:price>`,
      `<g:availability>${item.availability}</g:availability>`,
      `<g:condition>new</g:condition>`,
      `<g:brand>Marina Muse International</g:brand>`,
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
