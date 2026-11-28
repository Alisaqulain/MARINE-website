import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { company } from "@/lib/company";
import { countryCode } from "@/lib/countries";
import { getProduct } from "@/lib/products";
import { shipGlobalDraftErrors, type ShipGlobalDraft } from "@/lib/shipglobal-checks";
import { getStorefrontProduct } from "@/lib/storefront-catalog";
import type { OrderRecord } from "@/lib/orders";

// ShipGlobal Vendor API v1 (developer.docs.shipglobal.in): Basic Auth with the ShipGlobal account email/password.
// The old label API (labels.shipglobal.in/api/v1) is ignored even if still set in SHIPGLOBAL_API_BASE.
const CONFIGURED_BASE = (process.env.SHIPGLOBAL_API_BASE ?? "").trim().replace(/\/$/, "");
const BASE = CONFIGURED_BASE && !/labels\.shipglobal\.in/.test(CONFIGURED_BASE) ? CONFIGURED_BASE : "https://app.shipglobal.in/apiv1";
const RATES_PATH = "/rates/calculate";
const ADD_ORDER_PATH = "/order/add";
const LABEL_PATH = "/order/getLabel";
const TRACKING_PATH = "/tools/tracking";

/**
 * The last login ShipGlobal refused (400/401/403), keyed by a hash of the credentials. Health checks do not
 * re-send the same rejected email/password for REJECTED_LOGIN_TTL_MS; new credentials are tried immediately.
 */
let rejectedLogin: { fingerprint: string; at: number; httpStatus: number; message: string } | null = null;
const REJECTED_LOGIN_TTL_MS = 6 * 60 * 60 * 1000;

function credentialFingerprint() {
  return createHash("sha256")
    .update(`${BASE}\n${process.env.SHIPGLOBAL_EMAIL?.trim() ?? ""}\n${process.env.SHIPGLOBAL_PASSWORD?.trim() ?? ""}`)
    .digest("hex");
}
const inflight = new Map<string, Promise<void>>();

export function shipGlobalConfigured() {
  return Boolean(process.env.SHIPGLOBAL_EMAIL?.trim() && process.env.SHIPGLOBAL_PASSWORD?.trim());
}

export function shipGlobalService() {
  const configured = process.env.SHIPGLOBAL_SERVICE?.trim() ?? "";
  return configured && !/^DHLECS$/i.test(configured) ? configured : "Shipglobal Direct";
}

export type ShipGlobalConnection = {
  ok: boolean;
  httpStatus: number | null;
  tokenReceived: boolean;
  service: string;
  endpoint: string;
  message: string;
  /** auth = credentials refused · config = request/URL problem · temporary = network/timeout/5xx */
  failure?: "auth" | "config" | "temporary";
  /** True when this result is the remembered rejection and nothing was sent to ShipGlobal. */
  fromCache?: boolean;
};

function loginFailureClass(status: number | null): ShipGlobalConnection["failure"] {
  if (status === 401 || status === 403) return "auth";
  if (!status || status >= 500) return "temporary";
  return "config";
}

function publicError(value: string) {
  return value
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:token|password)\b\s*[:=]\s*\S+/gi, "[redacted]")
    .slice(0, 400);
}

function logShipGlobal(event: string, fields: Record<string, string | number | boolean | null>) {
  console.info("[shipglobal]", event, fields);
}

/** Checks the login with a free rate calculation. Does not create a shipment. Never returns the password. */
export async function pingShipGlobal(): Promise<ShipGlobalConnection> {
  const endpoint = `POST ${RATES_PATH}`;
  const service = shipGlobalService();
  if (!shipGlobalConfigured()) {
    return {
      ok: false,
      httpStatus: null,
      tokenReceived: false,
      service,
      endpoint,
      message: "SHIPGLOBAL_EMAIL and SHIPGLOBAL_PASSWORD are not set. Shipping is not connected.",
    };
  }
  if (rejectedLogin && rejectedLogin.fingerprint === credentialFingerprint() && Date.now() - rejectedLogin.at < REJECTED_LOGIN_TTL_MS) {
    return {
      ok: false,
      httpStatus: rejectedLogin.httpStatus,
      tokenReceived: false,
      service,
      endpoint,
      failure: loginFailureClass(rejectedLogin.httpStatus),
      fromCache: true,
      message: `${rejectedLogin.message} (Result from ${new Date(rejectedLogin.at).toISOString().slice(0, 16).replace("T", " ")} UTC — these same credentials are not re-sent until they change or 6 hours pass.)`,
    };
  }
  try {
    const { res, data } = await apiPost(RATES_PATH, { package_weight: "0.5", country_iso_code_2: "US", postcode: "10001" });
    if (!res.ok || data.success !== true) {
      const message = apiFailureMessage(res.status, data);
      if (res.status === 401 || res.status === 403 || data.error_code === "EA_401") {
        rejectedLogin = { fingerprint: credentialFingerprint(), at: Date.now(), httpStatus: res.status || 401, message };
      }
      return { ok: false, httpStatus: res.status, tokenReceived: false, service, endpoint, failure: loginFailureClass(res.status === 200 ? 401 : res.status), message };
    }
    rejectedLogin = null;
    return {
      ok: true,
      httpStatus: res.status,
      tokenReceived: true,
      service,
      endpoint,
      message: "ShipGlobal accepted the login (rate check OK). Shipping is connected. No shipment was created.",
    };
  } catch (err) {
    const detail = publicError(err instanceof Error ? err.message : "ShipGlobal check failed.");
    return { ok: false, httpStatus: null, tokenReceived: false, service, endpoint, failure: "temporary", message: detail };
  }
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

function authHeaders() {
  const email = process.env.SHIPGLOBAL_EMAIL?.trim() ?? "";
  const password = process.env.SHIPGLOBAL_PASSWORD?.trim() ?? "";
  if (!email || !password) throw new Error("Add SHIPGLOBAL_EMAIL and SHIPGLOBAL_PASSWORD on the server.");
  return {
    Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function apiPost(pathName: string, body: Record<string, unknown>, timeoutMs = 45_000) {
  const res = await fetch(`${BASE}${pathName}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

function apiFailureMessage(status: number, data: Record<string, unknown>) {
  const error = String(data.error || data.msg || data.message || "");
  if (status === 401 || data.error_code === "EA_401") {
    return "ShipGlobal refused the login (EA_401 Invalid Username/Password). Use the ShipGlobal account email and password (Basic Auth). No shipment was created.";
  }
  return error ? `ShipGlobal returned HTTP ${status}: ${publicError(error)}` : `ShipGlobal returned HTTP ${status}.`;
}

/** ShipGlobal tracking numbers look like SG32611267981716; find one anywhere in a response. */
function findTracking(data: unknown): string {
  const text = JSON.stringify(data ?? {});
  return /\bSG\d{9,}\b/.exec(text)?.[0] ?? "";
}

/**
 * Pay & Get Label for an existing ShipGlobal tracking number (charged to the wallet once; ShipGlobal returns the
 * same label again afterwards). Saves the PDF next to the other labels.
 */
export async function fetchShipGlobalLabel(orderId: string, tracking: string) {
  const { res, data } = await apiPost(LABEL_PATH, { tracking, label: true });
  logShipGlobal("order/getLabel", { orderId, status: res.status, success: data.success === true });
  const pdf = typeof data.label === "string" ? data.label : "";
  if (data.success !== true || !pdf) throw new Error(apiFailureMessage(res.status, data));
  const file = labelFilePath(orderId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(pdf, "base64"));
  return file;
}

/** Package weight in kg for an order (same estimate the booking uses). */
async function orderWeightKg(order: OrderRecord) {
  let grams = 0;
  for (const line of order.items) {
    const product = (await getStorefrontProduct(line.slug)) ?? getProduct(line.slug);
    grams += gramsFrom(product?.weight, line.qty);
  }
  return (Math.max(grams, 50) / 1000).toFixed(3);
}

/** Live ShipGlobal services and prices (INR) for this order's destination — FedEx, DHL, Aramex, UPS where offered. */
export async function shipGlobalRates(order: OrderRecord) {
  const destination = countryCode(order.country);
  if (!destination) throw new Error("The order has no valid destination country.");
  const { res, data } = await apiPost(RATES_PATH, { package_weight: await orderWeightKg(order), country_iso_code_2: destination, postcode: order.postal }, 20_000);
  if (!res.ok || data.success !== true) throw new Error(apiFailureMessage(res.status, data));
  const services = Array.isArray(data.services) ? (data.services as Record<string, unknown>[]) : [];
  return {
    weight: `${data.billed_weight ?? ""} ${data.billed_weight_unit ?? ""}`.trim(),
    currency: String(data.currency ?? "INR"),
    services: services.map((s) => ({
      title: String(s.title ?? ""),
      transit: String(s.transit_time ?? ""),
      notes: String(s.notes ?? ""),
      total: Number(s.subtotal_fee ?? (s.price as Record<string, unknown> | undefined)?.logistic_fee ?? 0),
    })),
  };
}

/** Live tracking (events + last-mile carrier link) for a ShipGlobal tracking number. */
export async function trackShipGlobal(tracking: string) {
  const { res, data } = await apiPost(TRACKING_PATH, { tracking }, 20_000);
  if (!res.ok || data.success !== true) throw new Error(apiFailureMessage(res.status, data));
  return data;
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
  const service = order.shipment?.service || shipGlobalService();
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
  const draft: ShipGlobalDraft = {
    customerName: order.name,
    email: order.email,
    phone: order.phone,
    address: shipTo.line1,
    city: order.city,
    state: order.state?.trim() || order.city,
    postal: order.postal,
    countryCode: destination,
    weightGrams: weight,
    service,
    items: items.map((item) => ({
      name: String(item.vendor_order_item_name),
      sku: String(item.vendor_order_item_sku),
      qty: Number(item.vendor_order_item_quantity),
      unitPrice: Number(item.vendor_order_item_unit_price),
      hsn: String(item.vendor_order_item_hsn),
    })),
    sellerPhone: company.phoneTel,
    sellerEmail: company.email,
    sellerAddress: seller.line1,
    sellerCity: company.city,
    sellerState: company.state,
    sellerPostal: company.pin,
    sellerCountryCode: "IN",
  };
  const problems = shipGlobalDraftErrors(draft);
  if (problems.length) {
    throw new Error(problems.join(" "));
  }
  const today = new Date().toISOString().slice(0, 10);
  const payload: Record<string, unknown> = {
    invoice_no: order.id,
    invoice_date: today,
    order_reference: order.id,
    service,
    package_weight: (Math.max(weight, 50) / 1000).toFixed(3),
    package_length: String(length),
    package_breadth: String(breadth),
    package_height: String(height),
    currency_code: "USD",
    csb5_status: Number(process.env.SHIPGLOBAL_CSB5 ?? "1") || 0,
    "csbv5-limit-comfirmation": 1,
    address_nickname: process.env.SHIPGLOBAL_PICKUP_NICKNAME?.trim() || "",
    customer_shipping_firstname: buyer.first,
    customer_shipping_lastname: buyer.last,
    customer_shipping_mobile: order.phone,
    customer_shipping_email: order.email,
    customer_shipping_company: "",
    customer_shipping_address: shipTo.line1,
    customer_shipping_address_2: shipTo.line2,
    customer_shipping_address_3: "",
    customer_shipping_city: order.city,
    customer_shipping_postcode: order.postal,
    customer_shipping_country_code: destination,
    customer_shipping_state: order.state?.trim() || order.city,
    ioss_number: process.env.SHIPGLOBAL_IOSS?.trim() || "",
    vendor_order_items: items.map((item) => ({
      ...item,
      vendor_order_item_quantity: String(item.vendor_order_item_quantity),
      vendor_order_item_unit_price: String(item.vendor_order_item_unit_price),
      vendor_order_item_tax_rate: String(item.vendor_order_item_tax_rate),
    })),
  };

  // 1) Create the order (no charge yet).
  const added = await apiPost(ADD_ORDER_PATH, payload);
  logShipGlobal("order/add", { orderId: order.id, status: added.res.status, success: added.data.success === true });
  let waybill = findTracking(added.data);
  if (!waybill) {
    const reason = apiFailureMessage(added.res.status, added.data);
    throw new Error(added.data.success === true ? "ShipGlobal created the order but returned no tracking number." : reason);
  }

  // 2) Pay & Get Label (charged to the ShipGlobal wallet). A wallet problem keeps the tracking number for a retry.
  const label = await apiPost(LABEL_PATH, { tracking: waybill, label: true });
  logShipGlobal("order/getLabel", { orderId: order.id, status: label.res.status, success: label.data.success === true });
  waybill = findTracking(label.data) || waybill;
  const pdf = typeof label.data.label === "string" ? label.data.label : "";
  if (pdf) {
    const file = labelFilePath(order.id);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(pdf, "base64"));
  }
  const labelError = label.data.success === true ? "" : apiFailureMessage(label.res.status, label.data);
  return {
    success: true,
    waybill,
    pdf,
    orderNumber: "",
    trackingUrl: `https://shipglobal.in/tracking/?tracking=${encodeURIComponent(waybill)}`,
    error: labelError,
  };
}

async function remember(order: OrderRecord) {
  const { getOrder, saveOrder } = await import("@/lib/orders");
  saveOrder(order);
  return getOrder(order.id);
}

export async function bookShipGlobalShipment(order: OrderRecord) {
  if (order.shipment?.waybill) return;
  // A sandbox test order on a development server must never book a real, billable label.
  if (process.env.NODE_ENV !== "production" && process.env.SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION !== "1") {
    throw new Error("ShipGlobal booking is disabled outside production.");
  }
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
        ...(label.error ? { error: `Order created (${label.waybill}) but the label was not paid: ${label.error} Top up the ShipGlobal wallet, then use Label / Retry.` } : {}),
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
      order.shipment = {
        provider: "shipglobal",
        error: publicError(err instanceof Error ? err.message : "ShipGlobal booking failed."),
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
