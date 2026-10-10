import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { getOrder, publicOrder, saveOrder, sendOrderConfirmation, whatsappConfirmUrl } from "@/lib/orders";

export async function POST(req: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "Secure checkout is not configured on the server." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");
  const razorpay_order_id = String(body?.razorpay_order_id ?? "");
  const razorpay_payment_id = String(body?.razorpay_payment_id ?? "");
  const razorpay_signature = String(body?.razorpay_signature ?? "");

  const order = getOrder(orderId);
  if (!order || !order.razorpayOrderId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match this order." }, { status: 400 });
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    order.status = "failed";
    saveOrder(order);
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  order.status = "paid";
  order.razorpayPaymentId = razorpay_payment_id;
  order.paidAt = new Date().toISOString();
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
}
