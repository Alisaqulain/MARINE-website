import { NextResponse } from "next/server";
import {
  defaultTracking,
  getOrderDurable,
  publicOrder,
  saveOrder,
  sendOrderConfirmation,
  whatsappConfirmUrl,
} from "@/lib/orders";
import { captureMatches, capturePayPalOrder, paypalConfigured } from "@/lib/paypal";

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json({ error: "PayPal is not configured on the server." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");
  const paypalOrderId = String(body?.paypalOrderId ?? "");
  const order = await getOrderDurable(orderId);
  if (!order || !order.paypalOrderId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.paypalOrderId !== paypalOrderId) {
    return NextResponse.json({ error: "This PayPal payment does not match the order." }, { status: 400 });
  }
  if (order.status === "paid") {
    return NextResponse.json({
      ok: true,
      order: publicOrder(order),
      token: order.token,
      whatsappUrl: whatsappConfirmUrl(order),
    });
  }

  try {
    const captured = await capturePayPalOrder(paypalOrderId);
    const check = captureMatches(order.amount, captured);
    if (!check.paid || !check.amountOk || (check.customId && check.customId !== order.id)) {
      order.status = "failed";
      saveOrder(order);
      return NextResponse.json({ error: "PayPal payment could not be verified." }, { status: 400 });
    }
    order.status = "paid";
    order.paypalCaptureId = check.captureId;
    order.paidAt = new Date().toISOString();
    if (!order.tracking) order.tracking = defaultTracking();
    saveOrder(order);
    try {
      await sendOrderConfirmation(order);
    } catch (err) {
      console.error("Order email failed", err);
    }
    return NextResponse.json({
      ok: true,
      order: publicOrder(order),
      token: order.token,
      whatsappUrl: whatsappConfirmUrl(order),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PayPal capture failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
