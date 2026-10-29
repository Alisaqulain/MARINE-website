import { buildMerchantFeed } from "@/lib/ai/growth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await buildMerchantFeed();
    return new NextResponse(feed.xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "X-Feed-Errors": String(feed.errors.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Product feed is unavailable." }, { status: 503 });
  }
}
