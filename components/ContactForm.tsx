"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function ContactForm() {
  const [done, setDone] = useState(false);
  const [kind, setKind] = useState<"retail" | "wholesale">("retail");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (done) {
    return (
      <div className="rounded-3xl bg-white p-8 py-10 text-center shadow-soft md:p-10">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#C9A84C]" />
        <h2 className="mt-4 font-serif text-3xl">Message received</h2>
        <p className="mt-2 text-navy-600">We’ll reply within one business day.</p>
      </div>
    );
  }

  return (
    <form
      className="rounded-3xl bg-white p-6 shadow-soft md:p-10"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            name: fd.get("name"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            company: fd.get("company"),
            subject: fd.get("subject"),
            message: fd.get("message"),
          }),
        });
        setLoading(false);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not send message.");
          return;
        }
        setDone(true);
      }}
    >
      <h2 className="font-serif text-2xl md:text-3xl">Send an Enquiry</h2>
      <div className="mt-5 grid grid-cols-2 rounded-full bg-[#F4F1EA] p-1 text-sm">
        <button
          type="button"
          className={`rounded-full py-2 ${kind === "retail" ? "bg-white shadow" : "text-navy-600"}`}
          onClick={() => setKind("retail")}
        >
          Retail
        </button>
        <button
          type="button"
          className={`whitespace-nowrap rounded-full px-2 py-2 ${kind === "wholesale" ? "bg-white shadow" : "text-navy-600"}`}
          onClick={() => setKind("wholesale")}
        >
          Wholesale / B2B
        </button>
      </div>
      <div className="mt-6 space-y-4">
        <input className="input" name="name" required placeholder="Full name" />
        <input className="input" name="email" type="email" required placeholder="Email" />
        <input className="input" name="phone" type="tel" placeholder="Phone / WhatsApp" />
        {kind === "wholesale" ? <input className="input" name="company" placeholder="Company" /> : null}
        <select className="input" name="subject" defaultValue="Product enquiry">
          <option>Product enquiry</option>
          <option>Wholesale pricing</option>
          <option>Custom manufacturing</option>
          <option>Order / shipping</option>
        </select>
        <textarea className="input min-h-36" name="message" required placeholder="How can we help?" />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
