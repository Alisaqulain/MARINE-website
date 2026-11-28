"use client";

import { useEffect, useMemo, useState } from "react";
import { countryName } from "@/lib/countries";
import { AdminOrdersPanel } from "@/components/AdminOrdersPanel";

type Stage = "" | "processing" | "in_transit" | "out_for_delivery" | "delivered";

type ShipmentRow = {
  id: string;
  status: string;
  name: string;
  email: string;
  city: string;
  country: string;
  amount: number;
  currency: string;
  createdAt: string;
  trackingNumber: string;
  trackingUrl: string;
  shipmentError: string;
  bookedAt: string;
  stage: Stage;
  stageUpdatedAt: string;
  items: number;
  paidAt: string;
};

type TabId = "to-ship" | "in-transit" | "delivered" | "problems";

const STAGE_LABEL: Record<string, string> = {
  processing: "Processing",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

/** Paid orders only; which shipping tab each one belongs to. */
function tabOf(row: ShipmentRow): TabId | null {
  if (row.status !== "paid") return null;
  if (row.stage === "delivered") return "delivered";
  if (!row.trackingNumber) return row.shipmentError ? "problems" : "to-ship";
  return "in-transit";
}

const TABS: { id: TabId; label: string }[] = [
  { id: "to-ship", label: "To ship" },
  { id: "in-transit", label: "Shipped (in transit)" },
  { id: "delivered", label: "Delivered" },
  { id: "problems", label: "Booking problems" },
];

function shortDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Shipping: pack, book and track paid orders (ShipGlobal), Shipbaba-style tabs and counts. */
export function AdminShipmentsPanel() {
  const [items, setItems] = useState<ShipmentRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [connection, setConnection] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<TabId>("to-ship");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"shipments" | "orders">("shipments");

  async function load() {
    const res = await fetch("/api/admin/shipments", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not load shipments.");
      return;
    }
    setConfigured(data.configured !== false);
    setConnection(typeof data.connectionMessage === "string" ? data.connectionMessage : "");
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { "to-ship": 0, "in-transit": 0, delivered: 0, problems: 0 };
    for (const row of items) {
      const t = tabOf(row);
      if (t) c[t] += 1;
    }
    return c;
  }, [items]);

  const rows = useMemo(() => {
    const list = items.filter((row) => tabOf(row) === tab);
    // To ship: oldest first so nothing waits too long; other tabs: newest first.
    return tab === "to-ship" || tab === "problems"
      ? [...list].sort((a, b) => (a.paidAt || a.createdAt).localeCompare(b.paidAt || b.createdAt))
      : list;
  }, [items, tab]);

  async function book(orderId: string) {
    setError("");
    setBusy(orderId);
    // 1) live services and prices for this order (FedEx, DHL, Aramex, UPS, ShipGlobal … as offered for the destination)
    const ratesRes = await fetch(`/api/admin/shipments?rates=${encodeURIComponent(orderId)}`, { cache: "no-store" });
    const rates = await ratesRes.json().catch(() => ({}));
    if (!ratesRes.ok || !Array.isArray(rates.services) || !rates.services.length) {
      setBusy("");
      setError(typeof rates.error === "string" ? rates.error : "ShipGlobal returned no services for this destination.");
      return;
    }
    // FedEx and UPS are not offered to the admin (business choice).
    rates.services = (rates.services as { title: string }[]).filter((s) => !/fedex|\bups\b/i.test(s.title));
    if (!rates.services.length) {
      setBusy("");
      setError("Only FedEx/UPS were offered for this destination.");
      return;
    }
    const list = (rates.services as { title: string; transit: string; total: number; notes: string }[])
      .map((s, i) => `${i + 1}. ${s.title} — ${rates.currency} ${s.total} — ${s.transit}${s.notes ? ` (${s.notes})` : ""}`)
      .join("\n");
    const choice = window.prompt(`Choose the courier for ${orderId} (billed weight ${rates.weight}).\nThe price is charged to the ShipGlobal wallet.\n\n${list}\n\nType the number:`, "1");
    const picked = choice ? rates.services[Number(choice) - 1] : null;
    if (!picked) {
      setBusy("");
      return;
    }
    // 2) book with that service
    const res = await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, service: picked.title }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not book this shipment.");
      return;
    }
    await load();
  }

  async function setStage(orderId: string, stage: Stage) {
    setError("");
    setBusy(orderId);
    const res = await fetch(`/api/admin/shipments/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update the delivery stage.");
      return;
    }
    await load();
  }

  const switcher = (
    <div className="flex gap-2">
      {([
        ["shipments", "Shipments"],
        ["orders", "All orders"],
      ] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setView(id)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            view === id ? "bg-[#031D38] text-white" : "bg-white text-[#031D38] ring-1 ring-[#e6dfd2] hover:ring-[#C9A84C]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // Order management inside Shipping: every order (paid, awaiting payment, cancelled) with details.
  if (view === "orders") {
    return (
      <div className="space-y-4">
        {switcher}
        <AdminOrdersPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {switcher}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy-900">Shipping</h2>
        <p className="mt-1 text-sm text-navy-600">
          Pack, book and track paid orders. Bookings go through ShipGlobal; the delivery stage you set here is what the
          customer sees on Track Order.
        </p>
        {configured ? null : (
          <p className="mt-3 text-sm text-red-700">
            Add SHIPGLOBAL_EMAIL and SHIPGLOBAL_PASSWORD to the server environment, then restart the site.
          </p>
        )}
        {connection ? <p className="mt-3 text-sm text-navy-700">ShipGlobal: {connection}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl bg-white p-4 text-left shadow-sm transition hover:ring-1 hover:ring-[#C9A84C] ${
              tab === t.id ? "ring-2 ring-[#031D38]" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-navy-600">{t.label}</p>
            <p className={`mt-1 font-serif text-2xl ${t.id === "problems" && counts.problems ? "text-red-700" : "text-navy-900"}`}>
              {loading ? "…" : counts[t.id]}
            </p>
          </button>
        ))}
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Shipping status">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              tab === t.id ? "bg-[#031D38] text-white" : "bg-white text-[#031D38] ring-1 ring-[#e6dfd2] hover:ring-[#C9A84C]"
            }`}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto text-xs font-semibold text-[#8C6E28] underline">
          Refresh
        </button>
      </nav>

      <div className="overflow-x-auto rounded-xl border border-[#eee] bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Ship to</th>
              <th className="px-4 py-3">Waybill</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-navy-600">
                  Loading shipments…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-navy-600">
                  Nothing here right now.
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} className="border-b border-[#f0f0f0] align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy-900">{item.id}</p>
                    <p className="text-xs text-navy-500">
                      Paid {shortDate(item.paidAt || item.createdAt)} · {item.items} item{item.items === 1 ? "" : "s"} · $
                      {Number(item.amount || 0).toFixed(2)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{item.name}</p>
                    <p className="text-xs text-navy-500">{item.email}</p>
                  </td>
                  <td className="px-4 py-3 text-navy-700">
                    {item.city}, {countryName(item.country)}
                  </td>
                  <td className="px-4 py-3">
                    {item.trackingNumber ? (
                      <a
                        href={item.trackingUrl || "https://shipglobal.in/tracking/"}
                        className="text-[#8C6E28] underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.trackingNumber}
                      </a>
                    ) : (
                      <span className="text-navy-500">Not booked</span>
                    )}
                    {item.shipmentError ? <p className="mt-1 max-w-xs text-xs text-red-700">{item.shipmentError}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {item.trackingNumber || item.stage === "delivered" ? (
                      <select
                        value={item.stage || "in_transit"}
                        disabled={busy === item.id}
                        onChange={(e) => void setStage(item.id, e.target.value as Stage)}
                        className="rounded-md border border-[#e6dfd2] bg-white px-2 py-1 text-xs"
                        aria-label={`Delivery stage for ${item.id}`}
                      >
                        {Object.entries(STAGE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-navy-500">Waiting to ship</span>
                    )}
                    {item.stageUpdatedAt && item.trackingNumber ? (
                      <p className="mt-1 text-[11px] text-navy-500">Updated {shortDate(item.stageUpdatedAt)}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {!item.trackingNumber && item.stage !== "delivered" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#8C6E28] underline"
                        disabled={busy === item.id}
                        onClick={() => void book(item.id)}
                      >
                        {busy === item.id ? "Booking…" : item.shipmentError ? "Retry ShipGlobal" : "Book on ShipGlobal"}
                      </button>
                    ) : null}
                    {item.trackingNumber ? (
                      <a
                        className="ml-3 text-xs font-semibold text-navy-800 underline"
                        href={`/api/admin/shipments/${encodeURIComponent(item.id)}/label`}
                      >
                        Label
                      </a>
                    ) : null}
                    {item.trackingNumber && item.stage !== "delivered" ? (
                      <button
                        type="button"
                        className="ml-3 text-xs font-semibold text-green-700 underline"
                        disabled={busy === item.id}
                        onClick={() => void setStage(item.id, "delivered")}
                      >
                        Mark delivered
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-navy-500">Shows the latest 200 orders. Unpaid and failed payments are not listed.</p>
    </div>
  );
}
