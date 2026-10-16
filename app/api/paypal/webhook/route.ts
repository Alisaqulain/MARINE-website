import { NextResponse } from "next/server";
import { defaultTracking, getOrderDurable, saveOrder, sendOrderConfirmation } from "@/lib/orders";
import { captureMatches, getPayPalOrder, paypalAccessToken, paypalBaseUrl, paypalConfigured } from "@/lib/paypal";

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json({ error: "PayPal is not configured." }, { status: 503 });
  }
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return NextResponse.json({ error: "PAYPAL_WEBHOOK_ID is not set." }, { status: 503 });
  }
  const event = await req.json().catch(() => null);
  if (!event || typeof event !== "object") {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  {
    const token = await paypalAccessToken();
    const verify = await fetch(`${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: req.headers.get("paypal-auth-algo"),
        cert_url: req.headers.get("paypal-cert-url"),
        transmission_id: req.headers.get("paypal-transmission-id"),
        transmission_sig: req.headers.get("paypal-transmission-sig"),
        transmission_time: req.headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
    const verified = (await verify.json()) as { verification_status?: string };
    if (verified.verification_status !== "SUCCESS") {
      return NextResponse.json({ error: "Webhook signature was rejected." }, { status: 400 });
    }
  }

  const resource = (event as { resource?: { supplementary_data?: { related_ids?: { order_id?: string } }; id?: string } }).resource;
  const paypalOrderId = resource?.supplementary_data?.related_ids?.order_id;
  const eventType = String((event as { event_type?: string }).event_type ?? "");
  if (!paypalOrderId || eventType !== "PAYMENT.CAPTURE.COMPLETED") {
    return NextResponse.json({ ok: true });
  }

  const paypalOrder = await getPayPalOrder(paypalOrderId);
  const customId = paypalOrder.purchase_units?.[0]?.custom_id ?? "";
  const order = customId ? await getOrderDurable(customId) : null;
  if (!order || order.paypalOrderId !== paypalOrderId || order.status === "paid") {
    return NextResponse.json({ ok: true });
  }
  const check = captureMatches(order.amount, paypalOrder);
  if (!check.paid || !check.amountOk) {
    return NextResponse.json({ ok: true });
  }
  order.status = "paid";
  order.paypalCaptureId = check.captureId || resource?.id;
  order.paidAt = new Date().toISOString();
  if (!order.tracking) order.tracking = defaultTracking();
  saveOrder(order);
  try {
    await sendOrderConfirmation(order);
  } catch (err) {
    console.error("Order email failed", err);
  }
  return NextResponse.json({ ok: true });
}
