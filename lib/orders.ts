import { regionalPrice, regionalWholesalePrice, type PriceRegion } from "@/lib/region";
import { getProduct, stockFor } from "@/lib/products";
import { getStorefrontProduct } from "@/lib/storefront-catalog";
import { company, companyWhatsApp } from "@/lib/company";
import { countryName } from "@/lib/countries";

export type OrderItem = {
  slug: string;
  name: string;
  qty: number;
  unitPrice: number;
  b2b?: boolean;
  personalisation?: "yes" | "no";
  message?: string;
};

export type OrderTrackingStage = "processing" | "in_transit" | "out_for_delivery" | "delivered";

export type OrderTracking = {
  stage: OrderTrackingStage;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  updatedAt?: string;
};

export type OrderShipment = {
  provider: "shipglobal";
  waybill?: string;
  orderNumber?: string;
  trackingUrl?: string;
  error?: string;
  bookedAt?: string;
};

export type OrderRecord = {
  id: string;
  token: string;
  status: "pending" | "paid" | "failed";
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state?: string;
  postal: string;
  country: string;
  items: OrderItem[];
  amount: number;
  currency: "USD";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentMethod?: "razorpay" | "paypal";
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paidAt?: string;
  estimatedDelivery: string;
  createdAt: string;
  emailSent?: boolean;
  tracking?: OrderTracking;
  shipment?: OrderShipment;
  /** First-party attribution session. Optional and unused by payment. */
  sessionId?: string;
  /** GA4 Measurement Protocol purchase event was accepted. */
  analyticsSent?: boolean;
};

export function defaultTracking(): OrderTracking {
  return {
    stage: "in_transit",
    updatedAt: new Date().toISOString(),
  };
}

export function trackingTimeline(tracking?: OrderTracking) {
  const stage = tracking?.stage ?? "processing";
  const order: OrderTrackingStage[] = ["processing", "in_transit", "out_for_delivery", "delivered"];
  const idx = Math.max(0, order.indexOf(stage));
  return [
    { label: "Packed & inspected", done: idx >= 0 },
    { label: "Collected by carrier", done: idx >= 1 },
    { label: "Out for delivery", done: idx >= 2 },
    { label: "Delivered", done: idx >= 3 },
  ];
}

type GlobalOrders = typeof globalThis & { __marinaOrders?: Map<string, OrderRecord> };

function store() {
  const g = globalThis as GlobalOrders;
  if (!g.__marinaOrders) g.__marinaOrders = new Map();
  return g.__marinaOrders;
}

export function newOrderId() {
  return `MM-${Date.now().toString(36).toUpperCase()}`;
}

export function newToken() {
  return crypto.randomUUID();
}

export function estimatedDelivery() {
  const start = new Date();
  start.setDate(start.getDate() + 5);
  const end = new Date();
  end.setDate(end.getDate() + 12);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function saveOrder(order: OrderRecord) {
  store().set(order.id, order);
  void persistOrder(order);
  return order;
}

async function persistOrder(order: OrderRecord) {
  try {
    const { getDb } = await import("@/lib/mongodb");
    const db = await getDb();
    await db.collection<OrderRecord>("orders").updateOne({ id: order.id }, { $set: order }, { upsert: true });
  } catch (err) {
    console.error("[orders] could not save to database", err);
  }
}

export function getOrder(id: string) {
  return store().get(id) ?? null;
}

export async function getOrderDurable(id: string) {
  const cached = getOrder(id);
  if (cached) return cached;
  try {
    const { getDb } = await import("@/lib/mongodb");
    const db = await getDb();
    const doc = await db.collection<OrderRecord>("orders").findOne({ id });
    if (!doc) return null;
    const { _id: _ignored, ...order } = doc as OrderRecord & { _id?: unknown };
    saveOrder(order);
    return order;
  } catch {
    return null;
  }
}

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Phase 2 commerce 2: database-backed (survives restarts and multiple instances). Callers must authorise first. */
export async function getOrdersByEmail(email: string): Promise<OrderRecord[]> {
  const q = email.trim().toLowerCase();
  if (!q) return [];
  const { getDb } = await import("@/lib/mongodb");
  const db = await getDb();
  const docs = await db
    .collection<OrderRecord>("orders")
    .find({ email: { $regex: `^${escapeRegex(q)}$`, $options: "i" }, status: "paid" })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return docs.map((doc) => {
    const { _id: _ignored, ...order } = doc as OrderRecord & { _id?: unknown };
    return order;
  });
}

/** Phase 2 commerce 2: needs both the order number and the matching email; reads the database. */
export async function trackOrderByEmail(orderId: string, email: string) {
  const order = await getOrderDurable(orderId.trim());
  if (!order || order.status !== "paid") return null;
  if (order.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return order;
}

/**
 * Phase 2 commerce 1: the single paid transition. One conditional database update decides the winner between the
 * PayPal capture route and the PayPal webhook; only the winner may fulfil the order and send the confirmation.
 * Throws on database errors (capture answers 502, webhook 500, so PayPal retries).
 */
let orderIndex: Promise<unknown> | null = null;
export async function markPaidOnce(order: OrderRecord, fields: { paypalCaptureId?: string; paidAt: string }) {
  const { getDb } = await import("@/lib/mongodb");
  const db = await getDb();
  const orders = db.collection<OrderRecord>("orders");
  if (!orderIndex) orderIndex = orders.createIndex({ id: 1 }, { unique: true, name: "order_id_once" }).catch(() => (orderIndex = null));
  await orderIndex;
  // Make sure the order exists, without overwriting anything a concurrent caller already wrote.
  const { status: _status, ...rest } = order;
  await orders.updateOne({ id: order.id }, { $setOnInsert: { ...rest, status: "pending" as const } }, { upsert: true }).catch((err) => {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 11000)) throw err;
  });
  const res = await orders.updateOne({ id: order.id, status: { $ne: "paid" } }, { $set: { status: "paid", ...fields } });
  const won = res.modifiedCount === 1;
  if (won) {
    Object.assign(order, { status: "paid" as const, ...fields });
  } else {
    const current = await orders.findOne({ id: order.id });
    if (current) {
      const { _id: _ignored, ...fresh } = current as OrderRecord & { _id?: unknown };
      Object.assign(order, fresh);
    }
  }
  store().set(order.id, order);
  return won;
}

export async function pricedItemsAsync(
  lines: { slug: string; qty: number; b2b?: boolean; personalisation?: string; message?: string }[],
  region: PriceRegion = "other"
) {
  const items: OrderItem[] = [];
  let amount = 0;
  for (const line of lines) {
    const product = (await getStorefrontProduct(line.slug)) ?? getProduct(line.slug);
    if (!product) continue;
    if (line.b2b ? product.b2bOutOfScope : product.b2cOutOfStock) continue;
    const stock = stockFor(product, Boolean(line.b2b));
    if (stock != null && stock <= 0) continue;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    const personalisation = line.personalisation === "yes" || line.personalisation === "no" ? line.personalisation : undefined;
    const charge =
      personalisation === "yes" && product.personalisationPrice != null
        ? Math.max(0, product.personalisationPrice)
        : 0;
    const message = personalisation === "yes" ? String(line.message ?? "").trim().slice(0, 300) : undefined;
    // Same price the shop shows: wholesale lines use the wholesale price, sales already applied.
    const unitPrice = (line.b2b ? regionalWholesalePrice(product, region) : regionalPrice(product, region)) + charge;
    items.push({
      slug: product.slug,
      name: product.name,
      qty,
      unitPrice,
      b2b: Boolean(line.b2b),
      personalisation,
      message,
    });
    amount += unitPrice * qty;
  }
  return { items, amount: Number(amount.toFixed(2)) };
}

export function pricedItems(lines: { slug: string; qty: number; b2b?: boolean }[]) {
  const items: OrderItem[] = [];
  let amount = 0;
  for (const line of lines) {
    const product = getProduct(line.slug);
    if (!product) continue;
    if (line.b2b ? product.b2bOutOfScope : product.b2cOutOfStock) continue;
    if (product.quantity != null && product.quantity <= 0) continue;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    items.push({
      slug: product.slug,
      name: product.name,
      qty,
      unitPrice: product.price,
      b2b: Boolean(line.b2b),
    });
    amount += product.price * qty;
  }
  return { items, amount: Number(amount.toFixed(2)) };
}

export function publicOrder(order: OrderRecord) {
  const { token: _token, shipment: _shipment, ...rest } = order;
  return rest;
}

export async function listRecentOrders(limit = 40): Promise<OrderRecord[]> {
  try {
    const { getDb } = await import("@/lib/mongodb");
    const db = await getDb();
    const docs = await db.collection("orders").find({}).sort({ createdAt: -1 }).limit(limit).toArray();
    return docs.map((doc) => {
      const { _id: _ignored, ...order } = doc as OrderRecord & { _id?: unknown };
      return order;
    });
  } catch {
    return [...store().values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
  }
}

/** Books the parcel with ShipGlobal, then saves the order. Never throws. */
export async function fulfillPaidOrder(order: OrderRecord) {
  try {
    const { bookShipGlobalShipment } = await import("@/lib/shipglobal");
    await bookShipGlobalShipment(order);
  } catch (err) {
    console.error("[shipglobal]", err);
    order.shipment = {
      provider: "shipglobal",
      error: err instanceof Error ? err.message : "ShipGlobal booking failed.",
    };
  }
  if (!order.tracking) order.tracking = defaultTracking();
  if (!order.analyticsSent) {
    try {
      const { sendPurchase } = await import("@/lib/google/analytics");
      const sent = await sendPurchase(order);
      if (sent.sent) order.analyticsSent = true;
    } catch (err) {
      console.error("[ga4] purchase event", err instanceof Error ? err.message : "failed");
    }
  }
  saveOrder(order);
}

export async function sendOrderConfirmation(order: OrderRecord) {
  const support = `${company.email} · ${company.phone}`;
  const lines = order.items
    .map((i) => {
      const note = i.personalisation === "yes" ? ` · Personalisation${i.message ? `: ${i.message}` : ""}` : "";
      return `${i.name} × ${i.qty} — $${(i.unitPrice * i.qty).toFixed(2)}${note}`;
    })
    .join("\n");
  const text = [
    `Order confirmation — ${company.name}`,
    `Order Number: ${order.id}`,
    `Payment Status: ${order.status === "paid" ? "Paid" : order.status}`,
    `Amount Paid: $${order.amount.toFixed(2)} ${order.currency}`,
    `Product Details:\n${lines}`,
    `Shipping Address: ${order.name}, ${order.address}, ${order.city}${order.state ? `, ${order.state}` : ""}, ${order.postal}, ${countryName(order.country)}`,
    order.tracking?.trackingNumber
      ? `ShipGlobal tracking: ${order.tracking.trackingNumber}${order.tracking.trackingUrl ? `\n${order.tracking.trackingUrl}` : ""}`
      : "ShipGlobal tracking is added when the parcel is booked.",
    `Estimated Delivery: ${order.estimatedDelivery}`,
    `Customer Support: ${support}`,
  ].join("\n\n");

  // Phase 2 commerce 3: SMTP (lib/mail.ts) is the delivery path. The order body is never logged. emailSent is set only
  // after the mail server accepted the message. Outside production nothing is sent (development side-effect guard).
  if (process.env.NODE_ENV !== "production") {
    console.info("[order-email] not sent outside production", { orderId: order.id });
    return { sent: false as const, reason: "development" };
  }
  const { sendCustomerMail } = await import("@/lib/mail");
  try {
    await sendCustomerMail(order.email, `Order ${order.id} confirmed — ${company.name}`, text);
  } catch (err) {
    order.emailSent = false;
    saveOrder(order);
    console.error("[order-email] failed", { orderId: order.id, error: err instanceof Error ? err.message.slice(0, 120) : "error" });
    throw new Error("Order confirmation email failed.");
  }
  order.emailSent = true;
  saveOrder(order);
  return { sent: true as const };
}

export function whatsappConfirmUrl(order: OrderRecord) {
  const msg = `Hello ${company.name}, my order ${order.id} is paid ($${order.amount.toFixed(2)}). Please confirm shipping to ${order.city}, ${order.country}.`;
  return `${companyWhatsApp}?text=${encodeURIComponent(msg)}`;
}
