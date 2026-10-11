import { getProduct } from "@/lib/products";
import { company, companyWhatsApp } from "@/lib/company";

export type OrderItem = {
  slug: string;
  name: string;
  qty: number;
  unitPrice: number;
  b2b?: boolean;
};

export type OrderTrackingStage = "processing" | "in_transit" | "out_for_delivery" | "delivered";

export type OrderTracking = {
  stage: OrderTrackingStage;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  updatedAt?: string;
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
  postal: string;
  country: string;
  items: OrderItem[];
  amount: number;
  currency: "USD";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
  estimatedDelivery: string;
  createdAt: string;
  emailSent?: boolean;
  tracking?: OrderTracking;
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
  return order;
}

export function getOrder(id: string) {
  return store().get(id) ?? null;
}

export function getOrdersByEmail(email: string) {
  const q = email.trim().toLowerCase();
  return [...store().values()]
    .filter((o) => o.email.toLowerCase() === q && o.status === "paid")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function trackOrderByEmail(orderId: string, email: string) {
  const order = getOrder(orderId.trim());
  if (!order || order.status !== "paid") return null;
  if (order.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return order;
}

export function pricedItems(lines: { slug: string; qty: number; b2b?: boolean }[]) {
  const items: OrderItem[] = [];
  let amount = 0;
  for (const line of lines) {
    const product = getProduct(line.slug);
    if (!product) continue;
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
  const { token: _t, ...rest } = order;
  return rest;
}

export async function sendOrderConfirmation(order: OrderRecord) {
  const support = `${company.email} · ${company.phone}`;
  const lines = order.items
    .map((i) => `${i.name} × ${i.qty} — $${(i.unitPrice * i.qty).toFixed(2)}`)
    .join("\n");
  const text = [
    `Order confirmation — ${company.name}`,
    `Order Number: ${order.id}`,
    `Payment Status: ${order.status === "paid" ? "Paid" : order.status}`,
    `Amount Paid: $${order.amount.toFixed(2)} ${order.currency}`,
    `Product Details:\n${lines}`,
    `Shipping Address: ${order.name}, ${order.address}, ${order.city}, ${order.postal}, ${order.country}`,
    `Estimated Delivery: ${order.estimatedDelivery}`,
    `Customer Support: ${support}`,
  ].join("\n\n");

  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ORDER_EMAIL_FROM ?? `${company.name} <noreply@${company.email.split("@")[1] ?? "example.com"}>`,
        to: [order.email],
        subject: `Order ${order.id} confirmed — ${company.name}`,
        text,
      }),
    });
    if (!res.ok) throw new Error("Email send failed");
  } else {
    console.info("[order-email]", { to: order.email, orderId: order.id, text });
  }

  order.emailSent = true;
  saveOrder(order);
}

export function whatsappConfirmUrl(order: OrderRecord) {
  const msg = `Hello ${company.name}, my order ${order.id} is paid ($${order.amount.toFixed(2)}). Please confirm shipping to ${order.city}, ${order.country}.`;
  return `${companyWhatsApp}?text=${encodeURIComponent(msg)}`;
}
