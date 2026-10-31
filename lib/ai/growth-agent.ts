import { getDb } from "@/lib/mongodb";
import { getSiteOrigin } from "@/lib/auth-url";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { agentInstructions, factsBlock, replyIsGrounded } from "@/lib/ai/agents";
import { approvedPolicyLines } from "@/lib/ai/crm";
import { generate, geminiConfigured, parseJsonReply } from "@/lib/ai/gemini";
import { ga4Summary } from "@/lib/google/analytics";
import { searchConsoleSummary } from "@/lib/google/search-console";

/**
 * Agent 3 (Growth & Revenue): Gemini drafts SEO/GEO/AEO content and research from verified data.
 * Every output is stored in `ai_content` as a draft; publishing is a restricted, owner-approved action.
 */

export type ContentKind = "product_seo" | "category_seo" | "buying_guide" | "faq" | "competitor_research";

export const CONTENT_KINDS: ContentKind[] = ["product_seo", "category_seo", "buying_guide", "faq", "competitor_research"];

const BRIEFS: Record<Exclude<ContentKind, "competitor_research">, string> = {
  product_seo:
    "Write SEO for one product page. JSON keys: title (≤60 chars), metaDescription (≤155 chars), h1, intro (80-120 words), bulletPoints (array of 4-6), faq (array of {q,a}, 3-5 items answerable from the facts), targetKeywords (array).",
  category_seo:
    "Write SEO for a category/collection page. JSON keys: title (≤60 chars), metaDescription (≤155 chars), h1, intro (120-180 words), sections (array of {heading, body}), faq (array of {q,a}), targetKeywords (array).",
  buying_guide:
    "Write a buying guide optimised for search engines and AI answer engines (GEO/AEO): clear direct answers, headings phrased as questions. JSON keys: title, metaDescription, sections (array of {heading, body}), faq (array of {q,a}), targetKeywords (array).",
  faq: "Write an FAQ block optimised for answer engines. JSON keys: title, faq (array of {q,a}, 6-10 items, each answer 1-3 sentences, answerable from the facts only), targetKeywords (array).",
};

async function searchContext() {
  const sc = await searchConsoleSummary(28).catch(() => ({ configured: false as const }));
  if (!("ok" in sc) || !sc.ok) return { text: "Search Console data: not connected.", connected: false };
  const lines = [
    "Search Console (last 28 days, observed):",
    ...sc.topQueries.slice(0, 10).map((q) => `- "${q.query}": ${q.clicks} clicks, ${q.impressions} impressions, position ${q.position}`),
    "Opportunities (impressions but low CTR, positions 4–20):",
    ...sc.opportunities.slice(0, 10).map((q) => `- "${q.query}": ${q.impressions} impressions, CTR ${q.ctr}%, position ${q.position}`),
  ];
  return { text: lines.join("\n"), connected: true };
}

export async function generateContentDraft(input: { kind: ContentKind; slug?: string; topic?: string; actor: string }) {
  if (!geminiConfigured()) return { error: "GEMINI_API_KEY is not set." as const };
  const topic = (input.topic || "").trim().slice(0, 200);
  const db = await getDb();
  const now = new Date().toISOString();

  if (input.kind === "competitor_research") {
    if (!topic) return { error: "Enter a product type, keyword or competitor to research." as const };
    const result = await generate({
      system: agentInstructions("growth"),
      turns: [
        {
          role: "user",
          text: `Research the search landscape for: "${topic}" for Marina Muse International (handcrafted brass and nautical decor, retail and wholesale export).
Use Google Search. Report: (1) which competitors and marketplaces rank for this and how they position (price tier, wholesale/MOQ, customisation), (2) content formats that rank (guides, FAQs, comparison pages), (3) questions buyers ask, (4) 5 concrete content or page ideas for Marina Muse. Cite what you found; say clearly when something is uncertain. Do not invent numbers.`,
        },
      ],
      googleSearch: true,
      temperature: 0.4,
      maxOutputTokens: 2048,
      timeoutMs: 45_000,
    });
    if (!result.ok) return { error: result.error || "Gemini research failed." };
    const doc = { id: `cnt_${Date.now().toString(36)}`, kind: input.kind, topic, status: "draft", body: result.text, sources: result.sources.slice(0, 20), createdBy: input.actor, createdAt: now };
    await db.collection("ai_content").insertOne({ ...doc });
    await db.collection("ai_audit").insertOne({ at: now, action: "growth_research", actor: input.actor, contentId: doc.id });
    return { content: doc };
  }

  const products = await getStorefrontProducts();
  const chosen = input.slug
    ? products.filter((p) => p.slug === input.slug)
    : topic
      ? products.filter((p) => `${p.name} ${p.category} ${(p.categories || []).join(" ")}`.toLowerCase().includes(topic.toLowerCase())).slice(0, 20)
      : products.slice(0, 20);
  if (input.kind === "product_seo" && !chosen.length) return { error: "Choose a product (slug) that exists in the catalogue." as const };
  const facts = factsBlock({
    products: chosen.map((p) => ({ name: p.name, sku: p.sku, price: p.price, stock: p.stock, quantity: p.quantity, material: p.material, dimensions: p.dimensions, href: `/product/${p.slug}`, moq: p.moq })),
    policies: approvedPolicyLines(),
    origin: getSiteOrigin(),
  });
  const descriptions = chosen.slice(0, 10).map((p) => `- ${p.name}: ${(p.description || "").replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
  const search = await searchContext();
  const result = await generate({
    system: agentInstructions("growth"),
    turns: [
      {
        role: "user",
        text: `${BRIEFS[input.kind]}\nTopic: ${topic || chosen[0]?.name || "Marina Muse catalogue"}\n\n${facts}\n\nProduct descriptions (verified):\n${descriptions}\n\n${search.text}\n\nReturn JSON only. Do not state any price, size, stock, delivery time or discount that is not in the facts.`,
      },
    ],
    json: true,
    temperature: 0.5,
    maxOutputTokens: 4096,
    timeoutMs: 45_000,
  });
  if (!result.ok) return { error: result.error || "Gemini did not return content." };
  const parsed = parseJsonReply<Record<string, unknown>>(result.text);
  if (!parsed) return { error: "Gemini returned content that was not valid JSON. Try again." as const };
  const check = replyIsGrounded(JSON.stringify(parsed), `${facts}\n${descriptions}`);
  const doc = {
    id: `cnt_${Date.now().toString(36)}`,
    kind: input.kind,
    topic: topic || chosen[0]?.name || "",
    slug: input.slug || null,
    status: check.grounded ? "draft" : "needs_review",
    body: parsed,
    groundingIssues: check.unsupported,
    usedSearchConsole: search.connected,
    createdBy: input.actor,
    createdAt: now,
  };
  await db.collection("ai_content").insertOne({ ...doc });
  await db.collection("ai_audit").insertOne({ at: now, action: "growth_draft", actor: input.actor, contentId: doc.id, kind: input.kind });
  return { content: doc };
}

export async function listContent(limit = 30) {
  const db = await getDb();
  const rows = await db.collection("ai_content").find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return rows.map(({ _id, ...rest }) => rest);
}

/** Owner decision on a draft. Approval records the decision; publishing to the site stays a manual step in the blog/product editor. */
export async function decideContent(input: { id: string; status: "approved" | "rejected"; actor: string }) {
  const db = await getDb();
  const res = await db.collection("ai_content").updateOne(
    { id: input.id, status: { $in: ["draft", "needs_review"] } },
    { $set: { status: input.status, decidedBy: input.actor, decidedAt: new Date().toISOString() } }
  );
  if (!res.matchedCount) return { error: "Draft not found or already decided." as const };
  await db.collection("ai_audit").insertOne({ at: new Date().toISOString(), action: "content_decision", contentId: input.id, status: input.status, actor: input.actor });
  return { ok: true as const };
}

/** GA4 + Search Console + an optional Gemini narrative for the daily report. */
export async function externalGrowthData(days = 7) {
  const [ga4, sc] = await Promise.all([ga4Summary(days).catch(() => ({ configured: false as const })), searchConsoleSummary(days).catch(() => ({ configured: false as const }))]);
  return { ga4, searchConsole: sc };
}

export async function growthNarrative(data: Record<string, unknown>) {
  if (!geminiConfigured()) return null;
  const result = await generate({
    system: agentInstructions("growth"),
    turns: [
      {
        role: "user",
        text: `From this data only, write 3-5 bullet insights for the owner (what changed, which landing pages/products/sources drive revenue, one concrete next action each). Plain text bullets starting with "• ". Data:\n${JSON.stringify(data).slice(0, 12_000)}`,
      },
    ],
    temperature: 0.3,
    maxOutputTokens: 1024,
    timeoutMs: 30_000,
  });
  if (!result.ok) return null;
  const check = replyIsGrounded(result.text, JSON.stringify(data));
  return check.grounded ? result.text : null;
}
