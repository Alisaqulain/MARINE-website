"use client";

import { formatPrice, showsFreeShipping } from "@/lib/products";
import { countries } from "@/lib/countries";
import { useCart } from "@/lib/cart-context";
import Link from "next/link";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function CheckoutForm() {
  const cart = useCart();
  const params = useSearchParams();
  const buyNow = params.get("buy") === "now" && cart.buyNowLines.length > 0;
  const items = buyNow ? cart.buyNowItems : cart.items;
  const subtotal = buyNow ? cart.buyNowSubtotal : cart.subtotal;
  const lines = buyNow ? cart.buyNowLines : cart.lines;
  const cancelled = params.get("paypal") === "cancelled";
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
    const customer = {
      lines,
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      address: form.get("address"),
      city: form.get("city"),
      state: form.get("state"),
      postal: form.get("postal"),
      country: form.get("country"),
      whatsapp,
    };
    try {
      const res = await fetch("/api/paypal/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start PayPal.");
      try {
        // Tells the PayPal return page whether to clear the bag or only the buy-now item.
        sessionStorage.setItem("marina-muse-checkout-mode", buyNow ? "buy-now" : "cart");
      } catch {
        /* ignore */
      }
      window.location.href = String(data.approveUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-8 lg:grid-cols-2 lg:py-10">
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
          <input className="input" name="state" required placeholder="State / region" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="input" name="postal" required placeholder="Postal code" />
          <select className="input" name="country" required defaultValue="">
            <option value="" disabled>
              Country
            </option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={whatsapp}
            onChange={(e) => setWhatsapp(e.target.checked)}
          />
          Optional: WhatsApp order confirmation after successful payment
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 text-navy-700">Payment method</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="pay-method" checked readOnly />
            PayPal secure checkout
          </label>
        </fieldset>
        {cancelled ? <p className="text-sm text-navy-700">PayPal checkout was cancelled. You can try again.</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="btn-gold w-full" type="submit" disabled={busy}>
          {busy ? "Connecting to PayPal…" : `Pay ${formatPrice(subtotal)} with PayPal`}
        </button>
        <p className="text-center text-xs text-navy-500">
          SSL protection · Payment securely processed by PayPal
        </p>
      </form>
      <aside className="sticky top-[calc(var(--site-nav)+1rem)] h-fit self-start rounded-2xl border border-cream-300/80 bg-white p-6 shadow-soft">
        <h2 className="font-serif text-2xl text-navy-900">Order summary</h2>
        <ul className="mt-4 divide-y divide-cream-300 border-b border-cream-300 pb-4">
          {items.map(({ product, qty, personalisation, message, unitPrice }) => (
            <li key={`${product.slug}-${personalisation ?? ""}-${message ?? ""}`} className="flex justify-between gap-3 py-3 text-sm first:pt-0">
              <span className="min-w-0 text-navy-800">
                {product.name} × {qty}
                {personalisation === "yes" ? (
                  <span className="mt-0.5 block text-xs text-navy-500">
                    Personalisation {formatPrice(Math.max(0, unitPrice - product.price))}
                    {message ? `: ${message}` : ""}
                  </span>
                ) : personalisation === "no" ? (
                  <span className="mt-0.5 block text-xs text-navy-500">
                    No personalisation · {formatPrice(product.price)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-medium">{formatPrice(unitPrice * qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-navy-600">Subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-navy-600">Shipping</dt>
            <dd className="text-right text-navy-700">
              {items.every(({ product }) => showsFreeShipping(product)) ? "Free · ShipGlobal" : "ShipGlobal"}
            </dd>
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

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-navy-600">Loading checkout…</div>}>
      <CheckoutForm />
    </Suspense>
  );
}
