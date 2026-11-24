"use client";

import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Result = {
  id: string;
  status: string;
  tracking?: { trackingNumber?: string; trackingUrl?: string; stage?: string };
};

const STAGE: Record<string, string> = {
  processing: "Processing",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function statusLine(order: Result) {
  if (order.status !== "paid") return order.status === "pending" ? "Awaiting payment" : "Not shipped";
  if (order.tracking?.stage) return STAGE[order.tracking.stage] ?? "In transit";
  return order.tracking?.trackingNumber ? "In transit" : "Preparing to ship";
}

/** Live order tracking strip shown above the footer on the home page (uses /api/orders/track). */
export function LiveTracking() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/track?${new URLSearchParams({ orderId: orderId.trim(), email: email.trim() })}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(typeof data.error === "string" ? data.error : "Could not find that order.");
      else setOrder(data.order as Result);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <section id="live-tracking" aria-labelledby="live-tracking-title" className="border-t border-[#eee7db] bg-[#FAF7F2] px-4 py-8 md:py-10">
      <div className="mx-auto max-w-3xl">
        <h2 id="live-tracking-title" className="flex items-center justify-center gap-2 font-serif text-2xl text-navy-950 md:text-3xl">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
          Track Your Order
        </h2>
        <p className="mt-1 text-center text-sm text-navy-600">Enter your order number and the email you ordered with.</p>
        <form onSubmit={submit} className="mt-5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Order number"
            aria-label="Order number"
            className="rounded-full border border-[#e6dfd2] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            className="rounded-full border border-[#e6dfd2] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#031D38] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            <PackageSearch className="h-4 w-4 text-[#C9A84C]" />
            {loading ? "Checking…" : "Track"}
          </button>
        </form>
        {error ? <p className="mt-3 text-center text-sm text-red-700">{error}</p> : null}
        {order ? (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
            <p className="font-medium text-navy-900">
              Order {order.id}: <span className="text-[#8C6E28]">{statusLine(order)}</span>
            </p>
            {order.tracking?.trackingNumber ? (
              <p className="mt-1 text-navy-600">
                Waybill{" "}
                <a
                  href={order.tracking.trackingUrl || "https://shipglobal.in/tracking/"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8C6E28] underline"
                >
                  {order.tracking.trackingNumber}
                </a>
              </p>
            ) : null}
            <Link
              href={`/track-order?orderId=${encodeURIComponent(order.id)}`}
              className="mt-2 inline-block text-xs font-semibold text-[#8C6E28] underline"
            >
              See full timeline
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
