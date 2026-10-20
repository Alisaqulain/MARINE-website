import { getSiteOrigin } from "@/lib/auth-url";

export function paypalBaseUrl() {
  const mode = (process.env.PAYPAL_MODE ?? "sandbox").trim().toLowerCase();
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalMode() {
  return (process.env.PAYPAL_MODE ?? "sandbox").trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export async function pingPayPal() {
  const mode = paypalMode();
  const webhookSet = Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim());
  if (!paypalConfigured()) {
    return {
      ok: false,
      mode,
      webhookSet,
      message: "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, then restart the server.",
    };
  }
  try {
    await paypalAccessToken();
    return {
      ok: true,
      mode,
      webhookSet,
      message: webhookSet
        ? "PayPal accepted the client id and secret."
        : "PayPal accepted the client id and secret. PAYPAL_WEBHOOK_ID is still empty, so payment webhooks will be rejected.",
    };
  } catch (err) {
    return {
      ok: false,
      mode,
      webhookSet,
      message: err instanceof Error ? err.message : "Could not sign in to PayPal.",
    };
  }
}

export async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const secret = process.env.PAYPAL_CLIENT_SECRET ?? "";
  if (!clientId || !secret) {
    throw new Error("PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Could not sign in to PayPal.");
  }
  return data.access_token;
}

export async function createPayPalCheckout(input: {
  orderId: string;
  amount: number;
  email: string;
  whatsapp?: boolean;
}) {
  const token = await paypalAccessToken();
  const origin = getSiteOrigin();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: input.orderId,
          invoice_id: input.orderId,
          amount: { currency_code: "USD", value: input.amount.toFixed(2) },
        },
      ],
      application_context: {
        brand_name: "Marina Muse International",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: `${origin}/checkout/paypal/return?order=${encodeURIComponent(input.orderId)}${
          input.whatsapp ? "&wa=1" : ""
        }`,
        cancel_url: `${origin}/checkout?paypal=cancelled`,
      },
    }),
  });
  const data = (await res.json()) as {
    id?: string;
    links?: { rel: string; href: string }[];
    message?: string;
    details?: { description?: string }[];
  };
  if (!res.ok || !data.id) {
    throw new Error(data.details?.[0]?.description ?? data.message ?? "Could not start PayPal checkout.");
  }
  const approve = data.links?.find((link) => link.rel === "payer-action" || link.rel === "approve");
  if (!approve?.href) throw new Error("PayPal did not return a checkout link.");
  return { paypalOrderId: data.id, approveUrl: approve.href };
}

export type PayPalCapture = {
  status?: string;
  purchase_units?: {
    custom_id?: string;
    payments?: { captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[] };
  }[];
};

export async function capturePayPalOrder(paypalOrderId: string) {
  const token = await paypalAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await res.json()) as PayPalCapture & { message?: string; details?: { description?: string; issue?: string }[] };
  if (!res.ok) {
    const issue = data.details?.[0]?.issue;
    if (issue === "ORDER_ALREADY_CAPTURED") {
      return getPayPalOrder(paypalOrderId);
    }
    throw new Error(data.details?.[0]?.description ?? data.message ?? "PayPal could not capture this payment.");
  }
  return data;
}

export async function getPayPalOrder(paypalOrderId: string) {
  const token = await paypalAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as PayPalCapture & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Could not read the PayPal order.");
  return data;
}

export function captureMatches(orderAmount: number, captured: PayPalCapture) {
  const unit = captured.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const value = capture?.amount?.value;
  const currency = capture?.amount?.currency_code;
  const status = capture?.status ?? captured.status;
  const paid = status === "COMPLETED";
  const amountOk = value === orderAmount.toFixed(2) && currency === "USD";
  return { paid, amountOk, captureId: capture?.id ?? "", customId: unit?.custom_id ?? "" };
}
