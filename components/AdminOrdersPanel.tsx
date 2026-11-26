"use client";

import { useEffect, useMemo, useState } from "react";
import { countryName } from "@/lib/countries";

type OrderRow = {
  id: string;
  status: "pending" | "paid" | "failed";
  createdAt: string;
  paidAt: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentRef: string;
  items: { slug: string; name: string; qty: number; unitPrice: number; b2b: boolean; personalisation?: string; message?: string }[];
  stage: string;
  trackingNumber: string;
  trackingUrl: string;
  emailSent: boolean;
};

type Filter = "all" | "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";

/** One status per order, as the customer sees it: payment first, then the delivery stage. */
function statusOf(o: OrderRow): Exclude<Filter, "all"> {
  if (o.status === "failed") return "cancelled";
  if (o.status !== "paid") return "pending";
  if (o.stage === "delivered") return "delivered";
  if (o.stage === "in_transit" || o.stage === "out_for_delivery" || (o.trackingNumber && o.stage !== "processing")) return "shipped";
  if (o.stage === "processing") return "processing";
  return "paid";
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Awaiting payment" },
  { id: "paid", label: "Paid" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];
const LABEL: Record<string, string> = Object.fromEntries(FILTERS.map((f) => [f.id, f.label]));
const PILL: Record<string, string> = {
  pending: "bg-[#eeeeee] text-navy-800",
  paid: "bg-green-100 text-green-800",
  processing: "bg-amber-100 text-amber-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-emerald-600 text-white",
  cancelled: "bg-red-100 text-red-700",
};

function when(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Admin Orders: every order placed on the site — filters, search, status and the ShipGlobal waybill. */
export function AdminOrdersPanel() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not load orders.");
      return;
    }
    setError("");
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (o) =>
        (filter === "all" || statusOf(o) === filter) &&
        (!q || [o.id, o.name, o.email, o.phone, o.city].some((v) => String(v || "").toLowerCase().includes(q)))
    );
  }, [items, filter, query]);

  return (
    <div>
      <h2 className="font-serif text-3xl text-navy-950">Orders</h2>
      <p className="mt-1 text-sm text-navy-600">Customer orders, payments and shipping.</p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filter === f.id ? "bg-[#031D38] text-white" : "bg-white text-navy-900 ring-1 ring-[#e6dfd2] hover:ring-[#C9A84C]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (!e.target.value) setQuery("");
          }}
          placeholder="Search order, name, email, phone"
          className="min-w-0 flex-1 rounded-lg border border-[#e6dfd2] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
        />
        <button type="submit" className="rounded-lg bg-[#031D38] px-5 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm sm:p-5">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#FAF7F2] text-xs font-semibold uppercase tracking-wide text-navy-700">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">ShipGlobal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-navy-600">
                  Loading orders…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-navy-600">
                  No orders found.
                </td>
              </tr>
            ) : (
              rows.flatMap((o) => {
                const st = statusOf(o);
                const qty = o.items.reduce((n, i) => n + (Number(i.qty) || 0), 0);
                const row = (
                  <tr
                    key={o.id}
                    onClick={() => setOpen(open === o.id ? "" : o.id)}
                    className="cursor-pointer border-b border-[#f0ece4] align-top hover:bg-[#FAF7F2]"
                    title="Click for details"
                  >
                    <td className="px-4 py-3 font-semibold text-navy-950">{o.id}</td>
                    <td className="px-4 py-3 text-navy-600">{when(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-navy-900">{o.name}</p>
                      <p className="text-xs text-navy-500">{o.phone || o.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {qty}
                      {o.items.some((i) => i.b2b) ? (
                        <span className="ml-1 rounded bg-[#031D38] px-1.5 py-0.5 text-[10px] text-white">B2B</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold">${Number(o.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${PILL[st]}`}>{LABEL[st]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {o.trackingNumber ? (
                        <a
                          href={o.trackingUrl || "https://shipglobal.in/tracking/"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#8C6E28] underline"
                        >
                          {o.trackingNumber}
                        </a>
                      ) : (
                        <span className="text-navy-400">—</span>
                      )}
                    </td>
                  </tr>
                );
                if (open !== o.id) return [row];
                return [
                  row,
                  <tr key={`${o.id}-details`} className="border-b border-[#f0ece4] bg-[#FAF7F2]">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid gap-4 text-sm md:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-navy-600">Ship to</p>
                          <p className="mt-1">{o.name}</p>
                          <p className="text-navy-700">{o.address}</p>
                          <p className="text-navy-700">
                            {o.city}
                            {o.state ? `, ${o.state}` : ""} {o.postal}
                          </p>
                          <p className="text-navy-700">{countryName(o.country)}</p>
                          <p className="mt-1 text-navy-700">{o.phone}</p>
                          <p className="text-navy-700">{o.email}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-navy-600">Items</p>
                          <ul className="mt-1 space-y-1">
                            {o.items.map((i, k) => (
                              <li key={`${i.slug}-${k}`}>
                                <a href={`/product/${i.slug}`} target="_blank" rel="noreferrer" className="text-navy-900 underline">
                                  {i.name}
                                </a>{" "}
                                × {i.qty} · ${Number(i.unitPrice || 0).toFixed(2)}
                                {i.b2b ? " · B2B" : ""}
                                {i.personalisation === "yes" ? (
                                  <span className="block text-xs text-navy-500">Engraving: {i.message || "—"}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-navy-600">Payment & delivery</p>
                          <p className="mt-1">
                            {LABEL[st]}
                            {o.paymentMethod ? ` · ${o.paymentMethod === "paypal" ? "PayPal" : "Razorpay"}` : ""}
                          </p>
                          {o.paidAt ? <p className="text-navy-700">Paid {when(o.paidAt)}</p> : null}
                          {o.paymentRef ? <p className="break-all text-xs text-navy-500">Ref {o.paymentRef}</p> : null}
                          <p className="mt-1 text-navy-700">Confirmation email: {o.emailSent ? "sent" : "not sent"}</p>
                          {o.status === "paid" && !o.trackingNumber ? (
                            <p className="mt-1 text-xs text-navy-500">Book the parcel in Shipping → Book on ShipGlobal.</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>,
                ];
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-navy-500">Click an order for details. Shows the latest 500 orders.</p>
    </div>
  );
}
