import { NextResponse } from "next/server";
import { detectRegion } from "@/lib/geo";
import { pricedItemsAsync } from "@/lib/orders";
import { rateLimit } from "@/lib/ai/crm";

export const dynamic = "force-dynamic";

/**
 * Live prices for the bag, using the same pricing as checkout (live listing, region, wholesale, active sales),
 * so the bag never shows a different amount from what PayPal will charge.
 */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!rateLimit(`cart-quote:${ip}`, 60)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const body = await req.json().catch(() => null);
  type Line = { slug: string; qty: number; b2b?: boolean; personalisation?: string };
  const lines: Line[] = (Array.isArray(body?.lines) ? (body.lines as unknown[]) : [])
    .slice(0, 50)
    .filter((line): line is Line => Boolean(line && typeof (line as { slug?: unknown }).slug === "string"));
  const region = await detectRegion(req);
  const items = await Promise.all(
    lines.map(async (line) => {
      const { items: priced } = await pricedItemsAsync([{ ...line, qty: 1 }], region);
      const item = priced[0];
      return {
        slug: line.slug,
        b2b: Boolean(line.b2b),
        personalisation: line.personalisation === "yes" ? "yes" : line.personalisation === "no" ? "no" : undefined,
        available: Boolean(item),
        unitPrice: item ? item.unitPrice : null,
        name: item?.name,
      };
    })
  );
  return NextResponse.json({ region, items });
}
