import { NextResponse } from "next/server";
import { publicOrder, trackOrderByEmail, trackingTimeline } from "@/lib/orders";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId") ?? searchParams.get("id") ?? "";
  const email = searchParams.get("email") ?? "";
  if (!orderId.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "Order number and email are required." }, { status: 400 });
  }
  const order = trackOrderByEmail(orderId, email);
  if (!order) {
    return NextResponse.json({ error: "No matching order found." }, { status: 404 });
  }
  return NextResponse.json({
    order: publicOrder(order),
    timeline: trackingTimeline(order.tracking),
  });
}
