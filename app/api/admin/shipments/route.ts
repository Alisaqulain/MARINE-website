import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { fulfillPaidOrder, getOrderDurable, listRecentOrders } from "@/lib/orders";
import { pingShipGlobal, shipGlobalConfigured, shipGlobalRates } from "@/lib/shipglobal";

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
    stage: order.tracking?.stage ?? "",
    stageUpdatedAt: order.tracking?.updatedAt ?? "",
    items: Array.isArray(order.items) ? order.items.reduce((n, i) => n + (Number(i.qty) || 0), 0) : 0,
    paidAt: order.paidAt ?? "",
  };
}

export async function GET(req: Request) {
  const { error } = await requireAdminSession("view");
  if (error) return error;
  // ?rates=<orderId>: live ShipGlobal services and prices for that order (nothing is booked).
  const ratesFor = new URL(req.url).searchParams.get("rates");
  if (ratesFor) {
    const order = await getOrderDurable(ratesFor);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    try {
      return NextResponse.json(await shipGlobalRates(order));
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load rates." }, { status: 502 });
    }
  }
  const orders = await listRecentOrders(200);
  const connection = await pingShipGlobal();
  return NextResponse.json({
    configured: shipGlobalConfigured(),
    connected: connection.ok,
    connectionMessage: connection.message,
    httpStatus: connection.httpStatus,
    tokenReceived: connection.tokenReceived,
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
  const service = typeof body?.service === "string" ? body.service.trim().slice(0, 80) : "";
  if (service && !order.shipment?.waybill) {
    // A new service choice replaces an earlier failed attempt so the booking runs again with it.
    order.shipment = { provider: "shipglobal", service };
  }
  await fulfillPaidOrder(order, { book: true });
  return NextResponse.json({ ok: true, item: view(order) });
}
