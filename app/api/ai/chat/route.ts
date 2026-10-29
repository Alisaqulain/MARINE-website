import { handleCustomerMessage, rateLimit } from "@/lib/ai/crm";
import { isPriceRegion, REGION_COOKIE, type PriceRegion } from "@/lib/region";
import { NextResponse } from "next/server";

function regionFrom(req: Request): PriceRegion {
  const cookie = req.headers.get("cookie") || "";
  const match = new RegExp(`${REGION_COOKIE}=([^;]+)`).exec(cookie);
  const value = match ? decodeURIComponent(match[1]) : "";
  return isPriceRegion(value) ? value : "other";
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!rateLimit(`chat:${ip}`)) {
    return NextResponse.json({ error: "Too many messages. Please wait a minute." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const sessionId = String(body?.sessionId || "").trim();
  const message = String(body?.message || "");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }
  try {
    const result = await handleCustomerMessage({
      sessionId,
      message,
      region: regionFrom(req),
      country: typeof body?.country === "string" ? body.country.slice(0, 80) : undefined,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      reply: result.reply || result.answer.text,
      products: result.answer.products.map((product) => ({
        slug: product.slug,
        name: product.name,
        price: product.price,
        href: product.href,
      })),
      quote: result.answer.quote,
      unknown: result.answer.unknown,
      lead: result.lead
        ? { score: result.lead.score, stage: result.lead.stage, estimatedValueUsd: result.lead.estimatedValueUsd }
        : null,
      approval: result.approval ? { status: result.approval.status, action: result.approval.action } : null,
    });
  } catch (err) {
    console.error("[ai-chat]", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Marina could not answer just now." }, { status: 503 });
  }
}
