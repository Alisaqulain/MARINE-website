import { NextResponse } from "next/server";
import { getStorefrontProducts } from "@/lib/storefront-catalog";

export async function GET(req: Request) {
  const channelParam = new URL(req.url).searchParams.get("channel");
  const channel =
    channelParam === "wholesale" ? "wholesale" : channelParam === "retail" ? "retail" : undefined;
  const items = await getStorefrontProducts(channel);
  return NextResponse.json({ items });
}
