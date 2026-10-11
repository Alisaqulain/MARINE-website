"use client";

import { formatPrice } from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import { company } from "@/lib/company";
import Link from "next/link";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const SAVED_ORDERS = "marina-muse-orders";

export default function CheckoutPage() {
  const { items, subtotal, clear, lines } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-serif text-3xl md:text-4xl">Nothing to check out</h1>
        <Link href="/shop" className="btn-gold mt-8">
          Shop
        </Link>
      </div>
    );
  }

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          address: form.get("address"),
          city: form.get("city"),
          postal: form.get("postal"),
          country: form.get("country"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start payment.");
      if (!window.Razorpay) throw new Error("Secure checkout failed to load.");

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: company.name,
        description: "Secure international checkout",
        order_id: data.razorpayOrderId,
        prefill: { name: data.name, email: data.email, contact: data.phone },
        theme: { color: "#C9A84C" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: data.orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const result = await verify.json();
          if (!verify.ok) throw new Error(result.error ?? "Payment could not be verified.");

          try {
            const prev = JSON.parse(localStorage.getItem(SAVED_ORDERS) ?? "[]") as { id: string; token: string }[];
            localStorage.setItem(
              SAVED_ORDERS,
              JSON.stringify([{ id: result.order.id, token: result.token }, ...prev.filter((o) => o.id !== result.order.id)])
            );
          } catch {
            /* ignore */
          }

          clear();
          const qs = new URLSearchParams({ order: result.order.id, token: result.token });
          if (whatsapp && result.whatsappUrl) qs.set("wa", result.whatsappUrl);
          router.push(`/checkout/confirmation?${qs.toString()}`);
        },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-8 lg:grid-cols-2 lg:py-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <form className="space-y-4" onSubmit={pay}>
        <h1 className="font-serif text-3xl leading-none md:text-4xl">Secure checkout</h1>
        <p className="text-sm text-navy-600">
          Pay through secure checkout. Your order is confirmed only after our server verifies the payment.{" "}
          <Link href="/payment" className="underline decoration-[#C9A84C]">
            How secure payment works
          </Link>
        </p>
        <input className="input" name="name" required placeholder="Full name" />
        <input className="input" name="email" type="email" required placeholder="Email" />
        <input className="input" name="phone" type="tel" required placeholder="Phone / WhatsApp" />
        <input className="input" name="address" required placeholder="Street address" />
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="input" name="city" required placeholder="City" />
          <input className="input" name="postal" required placeholder="Postal code" />
        </div>
        <input className="input" name="country" required placeholder="Country" />
        <label className="flex items-start gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={whatsapp}
            onChange={(e) => setWhatsapp(e.target.checked)}
          />
          Optional: WhatsApp order confirmation after successful payment
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="btn-gold w-full" type="submit" disabled={busy}>
          {busy ? "Connecting to secure checkout…" : `Pay ${formatPrice(subtotal)}`}
        </button>
        <p className="text-center text-xs text-navy-500">
          SSL protection · Cards, UPI, netbanking and wallets at secure checkout
        </p>
      </form>
      <aside className="sticky top-[calc(var(--site-nav)+1rem)] h-fit self-start rounded-2xl border border-cream-300/80 bg-white p-6 shadow-soft">
        <h2 className="font-serif text-2xl text-navy-900">Order summary</h2>
        <ul className="mt-4 divide-y divide-cream-300 border-b border-cream-300 pb-4">
          {items.map(({ product, qty }) => (
            <li key={product.slug} className="flex justify-between gap-3 py-3 text-sm first:pt-0">
              <span className="min-w-0 text-navy-800">
                {product.name} × {qty}
              </span>
              <span className="shrink-0 font-medium">{formatPrice(product.price * qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-navy-600">Subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-navy-600">Shipping</dt>
            <dd className="text-navy-700">Calculated at checkout</dd>
          </div>
        </dl>
        <div className="mt-4 flex justify-between border-t border-cream-300 pt-4 font-serif text-lg">
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <WholesaleNavLink
          callbackUrl="/wholesale/quote"
          className="mt-4 block text-center text-xs text-navy-600 underline"
        >
          Need a wholesale lot instead?
        </WholesaleNavLink>
      </aside>
    </div>
  );
}
