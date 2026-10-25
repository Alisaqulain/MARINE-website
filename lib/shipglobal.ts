import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { company } from "@/lib/company";
import { countryCode } from "@/lib/countries";
import { getProduct } from "@/lib/products";
import { shipGlobalDraftErrors, type ShipGlobalDraft } from "@/lib/shipglobal-checks";
import { getStorefrontProduct } from "@/lib/storefront-catalog";
import type { OrderRecord } from "@/lib/orders";

const BASE = (process.env.SHIPGLOBAL_API_BASE ?? "https://labels.shipglobal.in/api/v1").replace(/\/$/, "");
const LOGIN_PATH = "/customers.php";
const ORDER_PATH = "/addOrder.php";

let cachedToken: { value: string; expires: number } | null = null;
const inflight = new Map<string, Promise<void>>();

export function shipGlobalConfigured() {
  return Boolean(process.env.SHIPGLOBAL_EMAIL?.trim() && process.env.SHIPGLOBAL_PASSWORD?.trim());
}

export function shipGlobalService() {
  return process.env.SHIPGLOBAL_SERVICE?.trim() || "DHLECS";
}

export type ShipGlobalConnection = {
  ok: boolean;
  httpStatus: number | null;
  tokenReceived: boolean;
  service: string;
  endpoint: string;
  message: string;
};

function publicError(value: string) {
  return value
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:token|password)\b\s*[:=]\s*\S+/gi, "[redacted]")
    .slice(0, 400);
}

function logShipGlobal(event: string, fields: Record<string, string | number | boolean | null>) {
  console.info("[shipglobal]", event, fields);
}

/** Logs in once. Does not create a shipment. Never returns the token or password. */
export async function pingShipGlobal(): Promise<ShipGlobalConnection> {
  const endpoint = `POST ${LOGIN_PATH}`;
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
  cachedToken = null;
  try {
    const result = await accessToken();
    if (!result.tokenReceived) {
      return {
        ok: false,
        httpStatus: result.httpStatus,
        tokenReceived: false,
        service,
        endpoint,
        message: result.message,
      };
    }
    return {
      ok: true,
      httpStatus: result.httpStatus,
      tokenReceived: true,
      service,
      endpoint,
      message: "ShipGlobal accepted the login and returned a token. Shipping is connected. No shipment was created.",
    };
  } catch (err) {
    const detail = publicError(err instanceof Error ? err.message : "ShipGlobal login failed.");
    return {
      ok: false,
      httpStatus: null,
      tokenReceived: false,
      service,
      endpoint,
      message: detail,
    };
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

function tokenExpiry(expiresAt: unknown) {
  if (typeof expiresAt !== "string") return Date.now() + 12 * 60 * 60 * 1000;
  const parsed = Date.parse(expiresAt.includes("T") ? expiresAt : `${expiresAt.replace(" ", "T")}Z`);
  if (!Number.isFinite(parsed)) return Date.now() + 12 * 60 * 60 * 1000;
  return parsed - 60_000;
}

function loginFailureMessage(status: number, error: string) {
  if (status === 401 || /invalid credentials/i.test(error)) {
    return "ShipGlobal label API returned HTTP 401 Invalid credentials. The saved email and password were sent as JSON to POST /customers.php and no token was returned. This account is not accepted by labels.shipglobal.in. Ask ShipGlobal to enable label-API access for this email, or confirm the label-portal password. The v2 dashboard at v2.app.shipglobal.in is a different login. No shipment was created.";
  }
  if (status === 404) {
    return "ShipGlobal login endpoint returned HTTP 404. Confirm POST /customers.php with ShipGlobal support before changing the API URL.";
  }
  return error
    ? `Shipping is not connected. ShipGlobal returned HTTP ${status}: ${publicError(error)}`
    : `Shipping is not connected. ShipGlobal returned HTTP ${status} and no token.`;
}

async function accessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) {
    return { token: cachedToken.value, httpStatus: 200, tokenReceived: true, message: "" };
  }
  const email = process.env.SHIPGLOBAL_EMAIL?.trim() ?? "";
  const password = process.env.SHIPGLOBAL_PASSWORD?.trim() ?? "";
  if (!email || !password) {
    throw new Error("Add SHIPGLOBAL_EMAIL and SHIPGLOBAL_PASSWORD on the server.");
  }
  const res = await fetch(`${BASE}${LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string; expires_at?: string };
  const tokenReceived = typeof data.token === "string" && data.token.length > 0;
  logShipGlobal("login", { status: res.status, tokenReceived, error: publicError(String(data.error || "")) });
  if (!res.ok || !tokenReceived || !data.token) {
    cachedToken = null;
    const message = loginFailureMessage(res.status, String(data.error || ""));
    return { token: "", httpStatus: res.status, tokenReceived: false, message };
  }
  cachedToken = { value: data.token, expires: tokenExpiry(data.expires_at) };
  return { token: data.token, httpStatus: res.status, tokenReceived: true, message: "" };
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

async function postAddOrder(token: string, payload: Record<string, unknown>, download: boolean) {
  const res = await fetch(`${BASE}${ORDER_PATH}${download ? "?download=true" : ""}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
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
  const service = shipGlobalService();
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

  const login = await accessToken();
  if (!login.tokenReceived || !login.token) {
    throw new Error(login.message || "ShipGlobal did not return a token.");
  }
  let booked = await postAddOrder(login.token, payload, false);
  const already = booked.res.status === 409 || /already generated/i.test(String(booked.data.error || ""));
  if (already) {
    logShipGlobal("addOrder", { orderId: order.id, status: booked.res.status, duplicate: true, download: true });
    booked = await postAddOrder(login.token, payload, true);
  }
  const { res, data } = booked;
  logShipGlobal("addOrder", {
    orderId: order.id,
    status: res.status,
    success: data.success === true,
    duplicate: already,
    download: already,
  });
  if (!res.ok && !data.success && !data.dpd) {
    const details = Array.isArray(data.details) ? data.details.map(String).join(" ") : "";
    throw new Error(publicError(String(data.error || details || "ShipGlobal could not create this shipment.")));
  }
  const label = readLabel(data);
  if (!label.success || !label.waybill) {
    throw new Error(publicError(label.error || "ShipGlobal did not return a waybill."));
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
