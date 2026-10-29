import { detectRegion } from "@/lib/geo";
import { getSiteOrigin } from "@/lib/auth-url";
import { NextResponse } from "next/server";
import { estimatedDelivery, newOrderId, newToken, pricedItemsAsync, saveOrder } from "@/lib/orders";
import { createPayPalCheckout, paypalConfigured } from "@/lib/paypal";

function requestOrigin(req: Request) {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (!host) return getSiteOrigin();
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const proto = forwarded || (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

function checkoutFields(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? "").trim(),
    email: String(body.email ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    address: String(body.address ?? "").trim(),
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
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

  const { items, amount: total } = await pricedItemsAsync(
    Array.isArray(body.lines) ? body.lines : [],
    await detectRegion(req)
  );
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
    sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 80) : undefined,
  });

  try {
    const paypal = await createPayPalCheckout({
      orderId: order.id,
      amount: total,
      email: order.email,
      name: order.name,
      address: order.address,
      city: order.city,
      state: order.state?.trim() || order.city,
      postal: order.postal,
      country: order.country,
      origin: requestOrigin(req),
      whatsapp: body.whatsapp === true,
    });
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
