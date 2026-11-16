import { NextResponse } from "next/server";
import {
  fulfillPaidOrder,
  getOrderDurable,
  markPaidOnce,
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
    if (!order.tracking?.trackingNumber) await fulfillPaidOrder(order);
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
    // Phase 2 commerce 1: only the caller that wins the conditional paid transition fulfils and emails.
    const won = await markPaidOnce(order, { paypalCaptureId: check.captureId, paidAt: new Date().toISOString() });
    if (won) {
      await fulfillPaidOrder(order);
      try {
        await sendOrderConfirmation(order);
      } catch {
        console.error("[order-email] confirmation not sent", { orderId: order.id });
      }
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
