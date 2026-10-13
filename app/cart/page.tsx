"use client";

import { B2B_MIN_ORDER_QTY, formatPrice } from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import Image from "next/image";
import Link from "next/link";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";

export default function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-serif text-3xl md:text-5xl">Your cart is empty</h1>
        <p className="mt-3 text-navy-600">The foundry is full. The bag is not.</p>
        <Link href="/shop" className="btn-gold mt-8">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl md:text-4xl">Cart</h1>
        <ul className="mt-8 divide-y divide-cream-300">
          {items.map(({ product, qty, b2b, personalisation, message, unitPrice }) => (
            <li key={`${product.slug}-${personalisation ?? ""}-${message ?? ""}`} className="flex gap-3 py-6 sm:gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-200 sm:h-28 sm:w-28">
                <Image src={product.image} alt="" fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/product/${product.slug}`} className="font-serif text-lg leading-snug sm:text-2xl">
                  {product.name}
                </Link>
                <p className="text-sm text-navy-600">{formatPrice(unitPrice)}</p>
                {personalisation === "yes" ? (
                  <p className="text-xs text-navy-600">
                    Personalisation {formatPrice(Math.max(0, unitPrice - product.price))}
                    {message ? `: ${message}` : ""}
                  </p>
                ) : personalisation === "no" ? (
                  <p className="text-xs text-navy-600">No personalisation · {formatPrice(product.price)}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex items-center rounded-full border border-cream-300">
                    <button
                      className="px-3 py-1 disabled:cursor-not-allowed disabled:opacity-30"
                      disabled={b2b && qty <= B2B_MIN_ORDER_QTY}
                      aria-label="Decrease quantity"
                      onClick={() => setQty(product.slug, qty - 1, { personalisation, message })}
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm">{qty}</span>
                    <button
                      className="px-3 py-1 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Increase quantity"
                      disabled={product.quantity != null && product.quantity > 0 && qty >= product.quantity}
                      onClick={() => setQty(product.slug, qty + 1, { personalisation, message })}
                    >
                      +
                    </button>
                  </div>
                  {b2b && (
                    <span className="whitespace-nowrap text-xs text-[#8C6E28]">Min. Order: {B2B_MIN_ORDER_QTY}</span>
                  )}
                  <button
                    className="text-sm text-navy-500 underline"
                    onClick={() => remove(product.slug, { personalisation, message })}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="shrink-0 font-serif text-base sm:text-xl">{formatPrice(unitPrice * qty)}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="sticky top-[calc(var(--site-nav)+1rem)] h-fit rounded-2xl border border-cream-300/80 bg-white p-6 shadow-soft">
        <h2 className="font-serif text-2xl text-navy-900">Summary</h2>
        <dl className="mt-4 space-y-3 border-b border-cream-300 pb-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-navy-600">Subtotal</dt>
            <dd className="font-medium text-navy-900">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-navy-600">Shipping</dt>
            <dd className="text-navy-700">Calculated at checkout</dd>
          </div>
        </dl>
        <div className="mt-4 flex justify-between font-serif text-lg">
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <Link href="/checkout" className="btn-gold mt-6 w-full text-center">
          Checkout
        </Link>
        <WholesaleNavLink
          callbackUrl="/wholesale/quote"
          className="mt-3 block text-center text-sm text-navy-600 underline"
        >
          Need a wholesale lot instead?
        </WholesaleNavLink>
      </aside>
    </div>
  );
}
