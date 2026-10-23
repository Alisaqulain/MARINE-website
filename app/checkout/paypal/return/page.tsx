"use client";

import { useCart } from "@/lib/cart-context";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const SAVED_ORDERS = "marina-muse-orders";

function PayPalReturnInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { clear, clearBuyNow } = useCart();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const orderId = params.get("order") ?? "";
    const paypalOrderId = params.get("token") ?? "";
    const wantsWhatsapp = params.get("wa") === "1";
    if (!orderId || !paypalOrderId) {
      setError("PayPal did not return a payment to confirm.");
      return;
    }
    void fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, paypalOrderId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Payment could not be confirmed.");
        try {
          const prev = JSON.parse(localStorage.getItem(SAVED_ORDERS) ?? "[]") as { id: string; token: string }[];
          localStorage.setItem(
            SAVED_ORDERS,
            JSON.stringify([{ id: data.order.id, token: data.token }, ...prev.filter((item) => item.id !== data.order.id)])
          );
        } catch {
          /* ignore */
        }
        let mode = "cart";
        try {
          mode = sessionStorage.getItem("marina-muse-checkout-mode") ?? "cart";
          sessionStorage.removeItem("marina-muse-checkout-mode");
        } catch {
          /* ignore */
        }
        if (mode === "buy-now") clearBuyNow();
        else clear();
        const qs = new URLSearchParams({ order: data.order.id, token: data.token });
        if (wantsWhatsapp && data.whatsappUrl) qs.set("wa", data.whatsappUrl);
        router.replace(`/checkout/confirmation?${qs.toString()}`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Payment could not be confirmed.");
      });
  }, [params, router, clear, clearBuyNow]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-3xl">Confirming PayPal payment</h1>
      <p className="mt-3 text-sm text-navy-600">{error || "Please wait while we verify the payment with PayPal."}</p>
    </div>
  );
}

export default function PayPalReturnPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-navy-600">Confirming PayPal payment…</div>}>
      <PayPalReturnInner />
    </Suspense>
  );
}
