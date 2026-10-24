import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { company } from "@/lib/company";
import { countryCode } from "@/lib/countries";
import { getProduct } from "@/lib/products";
import { getStorefrontProduct } from "@/lib/storefront-catalog";
import type { OrderRecord } from "@/lib/orders";

const BASE = (process.env.SHIPGLOBAL_API_BASE ?? "https://labels.shipglobal.in/api/v1").replace(/\/$/, "");

let cachedToken: { value: string; expires: number } | null = null;
const inflight = new Map<string, Promise<void>>();

export function shipGlobalConfigured() {
  return Boolean(process.env.SHIPGLOBAL_EMAIL?.trim() && process.env.SHIPGLOBAL_PASSWORD?.trim());
}

export function labelFilePath(orderId: string) {
  return path.join(process.cwd(), "data", "labels", `${orderId.replace(/[^A-Za-z0-9-]/g, "")}.pdf`);
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || "Customer";
  const last = parts.slice(1).join(" ") || first;
  return { first, last };
}

function splitAddress(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    line1: (parts[0] || address).slice(0, 120),
    line2: (parts.slice(1).join(", ") || "NA").slice(0, 120),
  };
}

function gramsFrom(weight: string | undefined, qty: number) {
  const text = weight ?? "";
  const amount = parseFloat(text);
  if (!Number.isFinite(amount) || amount <= 0) return 400 * qty;
  const each = /kg/i.test(text) ? amount * 1000 : amount;
  return Math.max(100, Math.round(each * qty));
}

function cmBox(dimensions: string | undefined) {
  const text = dimensions ?? "";
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  const toCm = (n: number) => (/cm/i.test(text) && !/in|\"/i.test(text) ? n : n * 2.54);
  const round = (n: number) => Math.max(1, Math.round(n));
  if (nums.length >= 3) return { l: round(toCm(nums[0])), b: round(toCm(nums[1])), h: round(toCm(nums[2])) };
  return { l: 25, b: 18, h: 12 };
}

async function accessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const email = process.env.SHIPGLOBAL_EMAIL?.trim() ?? "";
  const password = process.env.SHIPGLOBAL_PASSWORD?.trim() ?? "";
  if (!email || !password) {
    throw new Error("Add SHIPGLOBAL_EMAIL and SHIPGLOBAL_PASSWORD on the server.");
  }
  const res = await fetch(`${BASE}/customers.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !data.token) {
    throw new Error(data.error || "ShipGlobal rejected the login.");
  }
  cachedToken = { value: data.token, expires: Date.now() + 12 * 60 * 60 * 1000 };
  return data.token;
}

function readLabel(data: Record<string, unknown>) {
  const dpd = (data.dpd ?? {}) as Record<string, unknown>;
  const raw = (dpd.raw_response ?? {}) as Record<string, unknown>;
  const nested = (data.data ?? {}) as Record<string, unknown>;
  const waybill = String(nested.waybill_number || dpd.waybill_number || raw.waybill_number || "");
  const pdf = String(nested.pdf_base64 || raw.pdf_base64 || "");
  const orderNumber = String(nested.order_number || data.order_id || "");
  const trackingUrl = String(raw.tracking_url || nested.tracking_url || "");
  const success = data.success === true || dpd.success === true || Boolean(waybill);
  const error = String(data.error || dpd.error || "");
  return { success, waybill, pdf, orderNumber, trackingUrl, error };
}

async function createLabel(order: OrderRecord) {
  const destination = countryCode(order.country);
  if (!destination) {
    throw new Error("Choose a country from the checkout list so ShipGlobal can accept the address.");
  }
  const buyer = splitName(order.name);
  const shipTo = splitAddress(order.address);
  const seller = splitAddress(company.address[0]);
  let weight = 0;
  let length = 25;
  let breadth = 18;
  let height = 12;
  const hsn = process.env.SHIPGLOBAL_HSN?.trim() || "74199990";
  const items = [];
  for (const line of order.items) {
    const product = (await getStorefrontProduct(line.slug)) ?? getProduct(line.slug);
    weight += gramsFrom(product?.weight, line.qty);
    const box = cmBox(product?.dimensions);
    length = Math.max(length, box.l);
    breadth = Math.max(breadth, box.b);
    height = Math.max(height, box.h);
    items.push({
      vendor_order_item_name: line.name.slice(0, 120),
      vendor_order_item_sku: (product?.sku || line.slug).slice(0, 40),
      vendor_order_item_quantity: line.qty,
      vendor_order_item_unit_price: Number(line.unitPrice.toFixed(2)),
      vendor_order_item_hsn: hsn,
      vendor_order_item_tax_rate: 0,
    });
  }
  const today = new Date().toISOString().slice(0, 10);
  const payload: Record<string, unknown> = {
    invoice_no: order.id,
    invoice_date: today,
    order_reference: order.id,
    service: process.env.SHIPGLOBAL_SERVICE?.trim() || "DHLECS",
    package_weight: weight,
    package_length: length,
    package_breadth: breadth,
    package_height: height,
    currency_code: "USD",
    csb5_status: Number(process.env.SHIPGLOBAL_CSB5 ?? "1") || 0,
    seller_nickname: "MarinaMuse",
    seller_firstname: process.env.SHIPGLOBAL_SELLER_FIRST?.trim() || "Marina",
    seller_lastname: process.env.SHIPGLOBAL_SELLER_LAST?.trim() || "Muse",
    seller_mobile: company.phoneTel,
    seller_email: company.email,
    seller_company: company.name,
    seller_address: seller.line1,
    seller_address_2: company.address[1] || seller.line2,
    seller_city: company.city,
    seller_postcode: company.pin,
    seller_country_code: "IN",
    seller_state: company.state,
    customer_shipping_firstname: buyer.first,
    customer_shipping_lastname: buyer.last,
    customer_shipping_mobile: order.phone,
    customer_shipping_email: order.email,
    customer_shipping_company: buyer.last === buyer.first ? "NA" : `${buyer.first} ${buyer.last}`,
    customer_shipping_address: shipTo.line1,
    customer_shipping_address_2: shipTo.line2,
    customer_shipping_city: order.city,
    customer_shipping_postcode: order.postal,
    customer_shipping_country_code: destination,
    customer_shipping_state: order.state?.trim() || order.city,
    vendor_order_items: items,
    tracking: order.id,
  };
  const ioss = process.env.SHIPGLOBAL_IOSS?.trim();
  if (ioss) payload.ioss_number = ioss;

  const token = await accessToken();
  const res = await fetch(`${BASE}/addOrder.php`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok && !data.success && !data.dpd) {
    const details = Array.isArray(data.details) ? data.details.map(String).join(" ") : "";
    throw new Error(String(data.error || details || "ShipGlobal could not create this shipment."));
  }
  const label = readLabel(data);
  if (!label.success || !label.waybill) {
    throw new Error(label.error || "ShipGlobal did not return a waybill.");
  }
  if (label.pdf) {
    const file = labelFilePath(order.id);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(label.pdf, "base64"));
  }
  return label;
}

async function remember(order: OrderRecord) {
  const { getOrder, saveOrder } = await import("@/lib/orders");
  saveOrder(order);
  return getOrder(order.id);
}

export async function bookShipGlobalShipment(order: OrderRecord) {
  if (order.shipment?.waybill) return;
  const existing = inflight.get(order.id);
  if (existing) {
    await existing;
    const { getOrder } = await import("@/lib/orders");
    const fresh = getOrder(order.id);
    if (fresh?.shipment || fresh?.tracking) {
      order.shipment = fresh.shipment;
      order.tracking = fresh.tracking;
    }
    return;
  }
  const job = (async () => {
    if (!shipGlobalConfigured()) {
      order.shipment = {
        provider: "shipglobal",
        error: "Add SHIPGLOBAL_EMAIL and SHIPGLOBAL_PASSWORD, then book this order again.",
      };
      order.tracking = {
        stage: "processing",
        carrier: "ShipGlobal",
        updatedAt: new Date().toISOString(),
      };
      await remember(order);
      return;
    }
    try {
      const label = await createLabel(order);
      const trackingUrl = label.trackingUrl || "https://shipglobal.in/tracking/";
      order.shipment = {
        provider: "shipglobal",
        waybill: label.waybill,
        orderNumber: label.orderNumber || undefined,
        trackingUrl,
        bookedAt: new Date().toISOString(),
      };
      order.tracking = {
        stage: "in_transit",
        carrier: "ShipGlobal",
        trackingNumber: label.waybill,
        trackingUrl,
        updatedAt: new Date().toISOString(),
      };
      await remember(order);
    } catch (err) {
      cachedToken = null;
      order.shipment = {
        provider: "shipglobal",
        error: err instanceof Error ? err.message : "ShipGlobal booking failed.",
      };
      order.tracking = {
        stage: "processing",
        carrier: "ShipGlobal",
        updatedAt: new Date().toISOString(),
      };
      await remember(order);
    }
  })();
  inflight.set(order.id, job);
  try {
    await job;
  } finally {
    inflight.delete(order.id);
  }
}
