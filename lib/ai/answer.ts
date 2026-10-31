export type CatalogueFact = {
  slug: string;
  name: string;
  sku: string;
  price: number;
  currency: "USD";
  material?: string;
  dimensions?: string;
  stock: string;
  quantity?: number;
  description: string;
  href: string;
  /** Wholesale minimum order quantity, when the product has wholesale pricing. */
  moq?: number;
};

export type PolicyTopic = "shipping" | "returns" | "warranty" | "discount" | "manufacturing";

export const APPROVED_POLICIES: Record<PolicyTopic, string | null> = {
  shipping:
    "Retail product pages show an estimated delivery of 7–12 business days. International parcels are booked with ShipGlobal after payment when that account is connected. A product shows free shipping only when that product is marked free shipping. For wholesale orders, the delivery timeline is confirmed after order review.",
  returns:
    "Eligible standard retail products can be returned within 14 days. Personalised or custom-made goods may be excluded from that 14-day return. Wholesale returns and refunds follow the agreed order terms and need written authorisation first. Full policy: /returns (wholesale: /returns#wholesale).",
  warranty: null,
  discount: "No discount, payment term, or custom commercial commitment is offered unless an owner has approved that exact request.",
  manufacturing:
    "Custom manufacturing is available. A quote is confirmed by the team. This assistant does not promise a production time or a unit price that is not on the current product record.",
};

export type Answer = {
  text: string;
  products: CatalogueFact[];
  quote: boolean;
  unknown: boolean;
  policy?: PolicyTopic;
};

const INJECTION = /ignore (all|any|previous) instructions|system prompt|you are now|approve (the )?discount/i;

const STOP = new Set(
  "the and for with what how much does price cost costs your you have has are any can this that from about tell want need buy available stock which there".split(" ")
);

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 2 && !STOP.has(part));
}

/** Name and SKU matches count three times as much as words that only appear in the description. */
function scoreProduct(query: string[], product: CatalogueFact) {
  const title = new Set(tokens(`${product.name} ${product.sku}`));
  const body = new Set(tokens(`${product.material || ""} ${product.description}`));
  return query.reduce((sum, token) => sum + (title.has(token) ? 3 : body.has(token) ? 1 : 0), 0);
}

export function answerFromCatalogue(question: string, products: CatalogueFact[]): Answer {
  const cleaned = question.replace(INJECTION, " ").trim();
  const query = tokens(cleaned);
  const lower = cleaned.toLowerCase();

  if (/\b(discount|% off|percent off|cheaper)\b/.test(lower)) {
    return { text: APPROVED_POLICIES.discount!, products: [], quote: false, unknown: false, policy: "discount" };
  }
  if (/\b(warranty|guarantee)\b/.test(lower)) {
    return {
      text: "I don't have an approved warranty statement to give you. I can only repeat what is written on the product page.",
      products: [],
      quote: false,
      unknown: true,
      policy: "warranty",
    };
  }
  if (/\b(return|refund)\b/.test(lower)) {
    return { text: APPROVED_POLICIES.returns!, products: [], quote: false, unknown: false, policy: "returns" };
  }
  if (/\b(ship|delivery|deliver)\b/.test(lower) && query.every((token) => !["compass", "telescope", "binocular"].includes(token))) {
    return { text: APPROVED_POLICIES.shipping!, products: [], quote: false, unknown: false, policy: "shipping" };
  }
  if (/\b(custom|manufactur|oem)\b/.test(lower) && !query.some((token) => products.some((product) => product.name.toLowerCase().includes(token)))) {
    return { text: APPROVED_POLICIES.manufacturing!, products: [], quote: true, unknown: false, policy: "manufacturing" };
  }

  const scoredRows = products
    .map((product) => ({ product, score: scoreProduct(query, product) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  // Keep only products close to the best match, so "brass compass" does not list every brass item.
  const best = scoredRows[0]?.score ?? 0;
  const ranked = scoredRows.filter((row) => row.score >= best - 1).slice(0, 3);

  if (!ranked.length) {
    return {
      text: "I don't have an approved catalogue match for that. I can help with a product name, price, material, stock, shipping, or returns.",
      products: [],
      quote: false,
      unknown: true,
    };
  }

  const lines = ranked.map(({ product }) => {
    const stock =
      product.quantity != null
        ? `${product.quantity} available`
        : product.stock === "in-stock"
          ? "in stock"
          : product.stock;
    const material = product.material ? ` Material: ${product.material}.` : "";
    const dimensions = product.dimensions && product.dimensions !== "See product description" ? ` Dimensions: ${product.dimensions}.` : "";
    const sku = product.sku ? ` (${product.sku})` : "";
    return `${product.name}${sku} is $${product.price.toFixed(2)} USD, ${stock}.${material}${dimensions} Page: ${product.href}`;
  });
  const quote = /\b(quote|wholesale|bulk|logo|oem)\b/i.test(lower);
  return {
    text: lines.join("\n"),
    products: ranked.map((row) => row.product),
    quote,
    unknown: false,
  };
}
