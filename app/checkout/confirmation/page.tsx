"use client";

import { formatPrice } from "@/lib/products";
import { countryName } from "@/lib/countries";
import { company } from "@/lib/company";
import { CheckCircle2, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type OrderView = {
  id: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
  state?: string;
  country: string;
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string };
  items: { slug: string; name: string; qty: number; unitPrice: number }[];
  amount: number;
  currency: string;
  paidAt?: string;
  estimatedDelivery: string;
  emailSent?: boolean;
};

function ConfirmationBody() {
  const params = useSearchParams();
  const id = params.get("order") ?? "";
  const token = params.get("token") ?? "";
  const wa = params.get("wa") ?? "";
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || !token) {
      setError("Missing order details.");
      return;
    }
    fetch(`/api/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Order not found");
        setOrder(data.order);
      })
      .catch((e: Error) => setError(e.message));
  }, [id, token]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl">We could not load this confirmation</h1>
        <p className="mt-3 text-navy-600">{error}</p>
        <Link href="/account/orders" className="btn-gold mt-8">
          Check order status
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center text-navy-600">
        Confirming your payment…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <CheckCircle2 className="h-12 w-12 text-[#C9A84C]" />
      <h1 className="mt-4 font-serif text-3xl md:text-4xl">Order confirmed</h1>
      <p className="mt-2 text-navy-600">
        Payment verified on our server. A confirmation email is on its way to {order.email}.
      </p>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-soft">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-navy-500">Order Number</dt>
            <dd className="font-medium text-navy-900">{order.id}</dd>
          </div>
          <div>
            <dt className="text-navy-500">Payment Status</dt>
            <dd className="font-medium capitalize text-[#2F7D4A]">{order.status}</dd>
          </div>
          <div>
            <dt className="text-navy-500">Amount Paid</dt>
            <dd className="font-medium">{formatPrice(order.amount)} {order.currency}</dd>
          </div>
          <div>
            <dt className="text-navy-500">Estimated Delivery</dt>
            <dd className="font-medium">{order.estimatedDelivery}</dd>
          </div>
        </dl>

        <h2 className="mt-6 font-serif text-xl">Product details</h2>
        <ul className="mt-2 divide-y divide-cream-300 text-sm">
          {order.items.map((item) => (
            <li key={item.slug} className="flex justify-between py-2">
              <span>
                {item.name} × {item.qty}
              </span>
              <span>{formatPrice(item.unitPrice * item.qty)}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-6 font-serif text-xl">Shipping address</h2>
        <p className="mt-1 text-sm leading-relaxed text-navy-700">
          {order.name}
          <br />
          {order.address}
          <br />
          {order.city}
          {order.state ? `, ${order.state}` : ""}, {order.postal}
          <br />
          {countryName(order.country)}
        </p>
        <p className="mt-4 text-sm text-navy-700">
          Shipped with ShipGlobal.
          {order.tracking?.trackingNumber ? (
            <>
              {" "}
              Tracking{" "}
              {order.tracking.trackingUrl ? (
                <a href={order.tracking.trackingUrl} className="text-[#8C6E28] underline" target="_blank" rel="noreferrer">
                  {order.tracking.trackingNumber}
                </a>
              ) : (
                order.tracking.trackingNumber
              )}
              .
            </>
          ) : (
            " The tracking number appears here once the parcel is booked."
          )}
        </p>

        <p className="mt-6 text-sm text-navy-600">
          Customer support: {company.phone} ·{" "}
          <Link href="/contact" className="text-[#8C6E28] underline">
            Contact us
          </Link>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/account/orders" className="btn-gold">
          View in my account
        </Link>
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className="btn-navy inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp confirmation
          </a>
        ) : null}
        <Link href="/contact" className="inline-flex items-center gap-2 text-sm text-navy-600 underline">
          <Mail className="h-4 w-4" />
          Contact support
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="px-4 py-20 text-center text-navy-600">Loading confirmation…</div>}>
      <ConfirmationBody />
    </Suspense>
  );
}
