import { NextResponse } from "next/server";
import { estimatedDelivery, newOrderId, newToken, pricedItemsAsync, saveOrder } from "@/lib/orders";

export async function POST(req: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Secure checkout is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { items, amount: total } = await pricedItemsAsync(Array.isArray(body.lines) ? body.lines : []);

  if (!items.length || total <= 0) {
    return NextResponse.json({ error: "Your cart has no valid products." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const city = String(body.city ?? "").trim();
  const postal = String(body.postal ?? "").trim();
  const country = String(body.country ?? "").trim();

  if (!name || !email || !phone || !address || !city || !postal || !country) {
    return NextResponse.json({ error: "Please complete all checkout fields." }, { status: 400 });
  }

  const order = saveOrder({
    id: newOrderId(),
    token: newToken(),
    status: "pending",
    name,
    email,
    phone,
    address,
    city,
    postal,
    country,
    items,
    amount: total,
    currency: "USD",
    estimatedDelivery: estimatedDelivery(),
    createdAt: new Date().toISOString(),
  });

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const rzp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(total * 100),
      currency: "USD",
      receipt: order.id,
      notes: { orderId: order.id, email: order.email },
    }),
  });

  const data = (await rzp.json()) as { id?: string; error?: { description?: string } };
  if (!rzp.ok || !data.id) {
    order.status = "failed";
    saveOrder(order);
    return NextResponse.json(
      { error: data.error?.description ?? "Could not start secure checkout." },
      { status: 502 }
    );
  }

  order.razorpayOrderId = data.id;
  saveOrder(order);

  return NextResponse.json({
    keyId,
    orderId: order.id,
    razorpayOrderId: data.id,
    amount: Math.round(total * 100),
    currency: "USD",
    name: order.name,
    email: order.email,
    phone: order.phone,
  });
}
