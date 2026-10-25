"use client";

import { useEffect, useState } from "react";
import { countryName } from "@/lib/countries";

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
};

export function AdminShipmentsPanel() {
  const [items, setItems] = useState<ShipmentRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [connection, setConnection] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const res = await fetch("/api/admin/shipments");
    const data = await res.json().catch(() => ({}));
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

  async function book(orderId: string) {
    setError("");
    setBusy(orderId);
    const res = await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not book this shipment.");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy-900">ShipGlobal</h2>
        <p className="mt-1 text-sm text-navy-600">
          Paid orders are booked on ShipGlobal and the waybill is saved on the order. Customers track it from Track Order.
        </p>
        {configured ? null : (
          <p className="mt-3 text-sm text-red-700">
            Add SHIPGLOBAL_EMAIL and SHIPGLOBAL_PASSWORD to the server environment, then restart the site.
          </p>
        )}
        {connection ? <p className="mt-3 text-sm text-navy-700">{connection}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#eee] bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Ship to</th>
              <th className="px-4 py-3">Waybill</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-navy-600">
                  No orders yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-[#f0f0f0] align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy-900">{item.id}</p>
                    <p className="text-xs capitalize text-navy-500">{item.status}</p>
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
                      <a href={item.trackingUrl || "https://shipglobal.in/tracking/"} className="text-[#8C6E28] underline" target="_blank" rel="noreferrer">
                        {item.trackingNumber}
                      </a>
                    ) : (
                      <span className="text-navy-500">Not booked</span>
                    )}
                    {item.shipmentError ? <p className="mt-1 max-w-xs text-xs text-red-700">{item.shipmentError}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.status === "paid" && !item.trackingNumber ? (
                      <button type="button" className="text-xs font-semibold text-[#8C6E28] underline" disabled={busy === item.id} onClick={() => void book(item.id)}>
                        {busy === item.id ? "Booking…" : "Book on ShipGlobal"}
                      </button>
                    ) : null}
                    {item.trackingNumber ? (
                      <a className="ml-3 text-xs font-semibold text-navy-800 underline" href={`/api/admin/shipments/${encodeURIComponent(item.id)}/label`}>
                        Label
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
