"use client";

import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type TimelineStep = { label: string; done: boolean };
type TrackOrder = {
  id: string;
  name: string;
  status: string;
  tracking?: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    stage?: string;
  };
};

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="bg-[#FAF7F2] px-5 py-16 text-center text-sm text-navy-600">Loading…</div>}>
      <TrackOrderContent />
    </Suspense>
  );
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = searchParams.get("orderId") ?? searchParams.get("id") ?? "";
    if (id) setOrderId(id);
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const q = new URLSearchParams({ orderId, email });
      const res = await fetch(`/api/orders/track?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not find that order.");
        setLoading(false);
        return;
      }
      setOrder(data.order);
      setTimeline(data.timeline ?? []);
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  const stageLabel =
    order?.tracking?.stage === "delivered"
      ? "Delivered"
      : order?.tracking?.stage === "out_for_delivery"
        ? "Out for delivery"
        : order?.tracking?.stage === "processing"
          ? "Processing"
          : "In transit";

  return (
    <div className="bg-[#FAF7F2] px-5 py-10 md:py-12">
      <div className="mx-auto max-w-[640px]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8C6E28]">Orders</p>
        <h1 className="mt-2 font-serif text-3xl md:text-5xl">Track Order</h1>
        <p className="mt-3 text-navy-600">
          Enter your order number and email. We will show the latest shipping status for retail and wholesale despatches.
        </p>

        {done && order ? (
          <div className="mt-10 rounded-3xl bg-white p-8 shadow-soft">
            <PackageSearch className="h-10 w-10 text-[#C9A84C]" />
            <h2 className="mt-4 font-serif text-3xl">{stageLabel}</h2>
            <p className="mt-2 text-sm text-navy-600">
              Order{" "}
              <Link href={`/track-order?orderId=${encodeURIComponent(order.id)}`} className="font-medium text-[#8C6E28] underline">
                {order.id}
              </Link>{" "}
              for {order.name}. Tracking updates usually appear within 24 hours of handover.
            </p>
            {order.tracking?.trackingNumber ? (
              <p className="mt-3 text-sm text-navy-800">
                {order.tracking.carrier ? `${order.tracking.carrier}: ` : ""}
                {order.tracking.trackingUrl ? (
                  <a href={order.tracking.trackingUrl} className="text-[#8C6E28] underline" target="_blank" rel="noreferrer">
                    {order.tracking.trackingNumber}
                  </a>
                ) : (
                  order.tracking.trackingNumber
                )}
              </p>
            ) : null}
            <ul className="mt-6 space-y-3 text-sm text-navy-700">
              {timeline.map((step) => (
                <li key={step.label} className="flex justify-between border-b border-[#eee7db] pb-2 last:border-0">
                  <span>{step.label}</span>
                  <span className={step.done ? "text-[#8C6E28]" : "text-navy-500"}>{step.done ? "Complete" : "Pending"}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-navy mt-8"
              onClick={() => {
                setDone(false);
                setOrder(null);
                setTimeline([]);
              }}
            >
              Track another order
            </button>
          </div>
        ) : (
          <form className="mt-10 space-y-4 rounded-3xl bg-white p-6 shadow-soft md:p-10" onSubmit={submit}>
            <input
              className="input"
              required
              placeholder="Order number (e.g. MM-20418)"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
            <input
              className="input"
              type="email"
              required
              placeholder="Email on the order"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button className="btn-gold w-full" disabled={loading}>
              {loading ? "Looking up…" : "Track order"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
