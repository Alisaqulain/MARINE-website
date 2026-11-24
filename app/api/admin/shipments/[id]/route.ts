import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOrderDurable, saveOrder, type OrderTrackingStage } from "@/lib/orders";

const STAGES: OrderTrackingStage[] = ["processing", "in_transit", "out_for_delivery", "delivered"];

/** Admin Shipping: move a paid order to another delivery stage (shown to the customer on Track Order). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const stage = String(body?.stage ?? "") as OrderTrackingStage;
  if (!STAGES.includes(stage)) return NextResponse.json({ error: "Unknown delivery stage." }, { status: 400 });
  const order = await getOrderDurable(decodeURIComponent(id));
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "paid") return NextResponse.json({ error: "Only paid orders can be shipped." }, { status: 400 });
  order.tracking = { ...(order.tracking ?? {}), stage, updatedAt: new Date().toISOString() };
  saveOrder(order);
  return NextResponse.json({ ok: true, stage });
}
