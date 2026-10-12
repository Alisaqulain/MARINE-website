"use client";

import { products } from "@/lib/products";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

const catalogProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

export function wholesaleApplicationPayload(fd: FormData) {
  const interest = String(fd.get("interest") ?? "");
  return {
    company: fd.get("company"),
    contact: fd.get("contact"),
    email: fd.get("email"),
    phone: fd.get("phone"),
    website: fd.get("website"),
    type: fd.get("type"),
    tax: fd.get("tax"),
    interest,
    interestOther: fd.get("interestOther"),
    password: fd.get("password"),
    confirm: fd.get("confirm"),
  };
}

export function WholesaleApplicationFields({ defaultEmail = "" }: { defaultEmail?: string }) {
  return (
    <>
      {(
        [
          ["Company Name", "company", "text", false],
          ["Contact Person", "contact", "text", true],
          ["Company email (login)", "email", "email", true],
          ["Phone", "phone", "tel", true],
          ["Website", "website", "url", false],
        ] as const
      ).map(([label, name, type, required]) => (
        <label key={name} className="block text-[13px]">
          <span className="mb-1.5 block text-navy-700">
            {label}
            {required ? "" : " (optional)"}
          </span>
          <input
            required={required}
            name={name}
            type={type}
            className="input"
            defaultValue={name === "email" ? defaultEmail : undefined}
            readOnly={name === "email" && Boolean(defaultEmail)}
            autoComplete={name === "email" ? "username" : name === "phone" ? "tel" : undefined}
          />
        </label>
      ))}
      <label className="block text-[13px]">
        <span className="mb-1.5 block text-navy-700">Business Type</span>
        <select name="type" className="input" required defaultValue="">
          <option value="" disabled>
            Select
          </option>
          <option>Retailer</option>
          <option>Wholesaler / Importer</option>
          <option>Hotel & Hospitality</option>
          <option>E-commerce</option>
        </select>
      </label>
      <label className="block text-[13px]">
        <span className="mb-1.5 block text-navy-700">Tax ID / VAT / GST</span>
        <input name="tax" className="input" required />
      </label>
      <ProductPicker name="interest" label="Products Interested In" />
    </>
  );
}

function ProductPicker({
  name,
  label,
  labelClassName = "text-navy-700",
}: {
  name: string;
  label: string;
  labelClassName?: string;
}) {
  const [value, setValue] = useState("");
  const other = value === "other";

  return (
    <div className="block text-[13px]">
      <label>
        <span className={`mb-1.5 block ${labelClassName}`}>{label}</span>
        <select
          name={name}
          className="input"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="" disabled>
            Select a product
          </option>
          {catalogProducts.map((p) => (
            <option key={`${name}-${p.slug}`} value={p.slug}>
              {p.name}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
      </label>
      {other && (
        <label className="mt-3 block">
          <span className={`mb-1.5 block ${labelClassName}`}>Product name</span>
          <input
            name={`${name}Other`}
            type="text"
            className="input"
            required
            placeholder="Type the product name"
          />
        </label>
      )}
    </div>
  );
}

export function WholesaleRegisterForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (done) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-[#C9A84C]" />
        <h3 className="mt-4 font-serif text-3xl">Application received</h3>
        <p className="mt-2 text-sm text-navy-600">We’ll review your trade account within one business day.</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        const res = await fetch("/api/wholesale/application", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wholesaleApplicationPayload(fd)),
        });
        setLoading(false);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not submit application.");
          return;
        }
        setDone(true);
      }}
    >
      <WholesaleApplicationFields />
      {error ? <p className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
      <button type="submit" className="btn-gold mt-2 w-full md:col-span-2" disabled={loading}>
        {loading ? "Submitting…" : "Submit Application"}
      </button>
    </form>
  );
}

export function BulkQuoteForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (done) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-[#C9A84C]" />
        <h3 className="mt-4 font-serif text-3xl">Quote requested</h3>
        <p className="mt-2 text-sm text-navy-600">FOB / CIF options will arrive within 24 hours.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        const incoterm = String(fd.get("incoterm") ?? "FOB");
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product: fd.get("product"),
            productOther: fd.get("productOther"),
            quantity: fd.get("quantity"),
            logoEngraving: fd.get("logoEngraving"),
            packaging: fd.get("packaging"),
            destinationCountry: fd.get("destinationCountry"),
            requiredDeliveryDate: fd.get("requiredDeliveryDate"),
            incoterm,
          }),
        });
        setLoading(false);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not submit quote.");
          return;
        }
        setDone(true);
      }}
    >
      <ProductPicker name="product" label="Product" labelClassName="" />
      <label className="block text-[13px]">
        <span className="mb-1.5 block">Quantity</span>
        <input name="quantity" className="input" type="number" min={12} defaultValue={50} required />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1.5 block">Logo / Engraving</span>
        <input name="logoEngraving" className="input" placeholder="Company crest, coordinates, or none" />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1.5 block">Packaging</span>
        <select name="packaging" className="input" defaultValue="Standard gift box">
          <option>Standard gift box</option>
          <option>Magnetic branded box</option>
          <option>Your packaging</option>
          <option>Export only / bulk packed</option>
        </select>
      </label>
      <label className="block text-[13px]">
        <span className="mb-1.5 block">Destination Country</span>
        <input name="destinationCountry" className="input" placeholder="United States" required />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1.5 block">Required Delivery Date</span>
        <input name="requiredDeliveryDate" className="input" type="date" />
      </label>
      <fieldset className="text-[13px]">
        <legend className="mb-2">Choose shipping</legend>
        <div className="flex flex-wrap gap-4">
          {["Ex Works", "FOB", "CIF", "DDP"].map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name="incoterm" value={t} defaultChecked={t === "FOB"} /> {t}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" className="btn-gold mt-2 w-full" disabled={loading}>
        {loading ? "Sending…" : "Get Quote Now"}
      </button>
    </form>
  );
}

export function TradeFormsPair() {
  return (
    <section className="bg-[#FAF7F2] px-5 py-10 md:py-12">
      <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-[0_10px_40px_rgba(26,20,12,0.06)] md:p-8">
          <h2 className="font-serif text-[1.85rem] text-navy-900">Create Your Wholesale Account</h2>
          <p className="mt-2 text-sm text-navy-600">
            Gain access to exclusive wholesale pricing, bulk orders and private-label programmes.
          </p>
          <div className="mt-6">
            <WholesaleRegisterForm />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_10px_40px_rgba(26,20,12,0.06)] md:p-8">
          <h2 className="font-serif text-[1.85rem] text-navy-900">Request a Bulk Quote</h2>
          <p className="mt-2 text-sm text-navy-600">
            Tell us what you need. We’ll return landed-cost options for your destination.
          </p>
          <div className="mt-6">
            <BulkQuoteForm />
          </div>
        </div>
      </div>
    </section>
  );
}
