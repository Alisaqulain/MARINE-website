import { NextResponse } from "next/server";
import { estimatedDelivery, newOrderId, newToken, pricedItemsAsync, saveOrder } from "@/lib/orders";
import { createPayPalCheckout, paypalConfigured } from "@/lib/paypal";

function checkoutFields(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? "").trim(),
    email: String(body.email ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    address: String(body.address ?? "").trim(),
    city: String(body.city ?? "").trim(),
    postal: String(body.postal ?? "").trim(),
    country: String(body.country ?? "").trim(),
  };
}

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json(
      { error: "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the server." },
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

  const customer = checkoutFields(body);
  if (Object.values(customer).some((value) => !value)) {
    return NextResponse.json({ error: "Please complete all checkout fields." }, { status: 400 });
  }

  const order = saveOrder({
    id: newOrderId(),
    token: newToken(),
    status: "pending",
    ...customer,
    items,
    amount: total,
    currency: "USD",
    paymentMethod: "paypal",
    estimatedDelivery: estimatedDelivery(),
    createdAt: new Date().toISOString(),
  });

  try {
    const paypal = await createPayPalCheckout({ orderId: order.id, amount: total, email: order.email });
    order.paypalOrderId = paypal.paypalOrderId;
    saveOrder(order);
    return NextResponse.json({ orderId: order.id, approveUrl: paypal.approveUrl });
  } catch (error) {
    order.status = "failed";
    saveOrder(order);
    const message = error instanceof Error ? error.message : "Could not start PayPal checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
