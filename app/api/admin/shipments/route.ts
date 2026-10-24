import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { fulfillPaidOrder, getOrderDurable, listRecentOrders } from "@/lib/orders";
import { shipGlobalConfigured } from "@/lib/shipglobal";

function view(order: Awaited<ReturnType<typeof listRecentOrders>>[number]) {
  return {
    id: order.id,
    status: order.status,
    name: order.name,
    email: order.email,
    city: order.city,
    country: order.country,
    amount: order.amount,
    currency: order.currency,
    createdAt: order.createdAt,
    trackingNumber: order.tracking?.trackingNumber ?? "",
    trackingUrl: order.tracking?.trackingUrl ?? "",
    shipmentError: order.shipment?.error ?? "",
    bookedAt: order.shipment?.bookedAt ?? "",
  };
}

export async function GET() {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  const orders = await listRecentOrders(50);
  return NextResponse.json({
    configured: shipGlobalConfigured(),
    items: orders.map(view),
  });
}

export async function POST(req: Request) {
  const { error } = await requireAdminSession("addProduct");
  if (error) return error;
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");
  const order = await getOrderDurable(orderId);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "paid") {
    return NextResponse.json({ error: "Only paid orders can be booked with ShipGlobal." }, { status: 400 });
  }
  await fulfillPaidOrder(order);
  return NextResponse.json({ ok: true, item: view(order) });
}
