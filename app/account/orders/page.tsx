"use client";

import { formatPrice } from "@/lib/products";
import Link from "next/link";
import { useEffect, useState } from "react";

type Saved = { id: string; token: string };
type OrderView = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  createdAt?: string;
  estimatedDelivery: string;
  items: { name: string; qty: number }[];
};

const KEY = "marina-muse-orders";

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Saved[];
        const loaded: OrderView[] = [];
        for (const s of saved) {
          const res = await fetch(`/api/orders/${encodeURIComponent(s.id)}?token=${encodeURIComponent(s.token)}`);
          if (!res.ok) continue;
          const data = await res.json();
          loaded.push(data.order);
        }
        setOrders(loaded);
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();
  }, []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/orders?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (res.ok) setOrders(data.orders ?? []);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#8C6E28]">Account</p>
      <h1 className="mt-2 font-serif text-3xl md:text-4xl">Order status</h1>
      <p className="mt-2 text-navy-600">Confirmed orders appear here after your secure checkout payment is verified.</p>

      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={lookup}>
        <input
          className="input flex-1"
          type="email"
          required
          placeholder="Email used at checkout"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn-gold shrink-0" type="submit">
          Find orders
        </button>
      </form>

      {loading ? (
        <p className="mt-8 text-sm text-navy-600">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-sm text-navy-600">
          No confirmed orders yet.{" "}
          <Link href="/checkout" className="underline">
            Go to checkout
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-xl">{o.id}</p>
                <p className="text-sm capitalize text-[#2F7D4A]">{o.status}</p>
              </div>
              <p className="mt-1 text-sm text-navy-600">
                {formatPrice(o.amount)} · Delivery {o.estimatedDelivery}
              </p>
              <ul className="mt-3 text-sm text-navy-800">
                {o.items.map((i) => (
                  <li key={`${o.id}-${i.name}`}>
                    {i.name} × {i.qty}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
