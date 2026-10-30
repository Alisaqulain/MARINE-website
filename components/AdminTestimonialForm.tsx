"use client";

import { useState } from "react";

const empty = () => ({
  title: "",
  body: "",
  name: "",
  location: "",
  product: "",
  published: true,
  showOnHome: true,
});

/** Lets admin add a shop testimonial (e.g. from email or WhatsApp feedback). */
export function AdminTestimonialForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setBusy(true);
    const res = await fetch("/api/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, title: form.title.trim(), body: form.body.trim(), name: form.name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not add the testimonial.");
      return;
    }
    setForm(empty());
    setSaved(true);
    onAdded();
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-gold px-5 py-2 text-sm" onClick={() => setOpen(true)}>
          + Add testimonial
        </button>
        {saved ? <span className="text-sm text-emerald-700">Testimonial added.</span> : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
      <h3 className="font-serif text-lg text-navy-900">Add testimonial</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-navy-600">
          Title
          <input
            className="input mt-1"
            placeholder="Absolutely beautiful"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            maxLength={120}
          />
        </label>
        <label className="block text-xs text-navy-600">
          Product
          <input
            className="input mt-1"
            placeholder="Antique Brass Nautical Compass"
            value={form.product}
            onChange={(e) => setForm({ ...form, product: e.target.value })}
            maxLength={200}
          />
        </label>
        <label className="block text-xs text-navy-600">
          Customer name
          <input
            className="input mt-1"
            placeholder="James W."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={120}
          />
        </label>
        <label className="block text-xs text-navy-600">
          Location
          <input
            className="input mt-1"
            placeholder="London"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            maxLength={120}
          />
        </label>
      </div>
      <label className="block text-xs text-navy-600">
        Testimonial
        <textarea
          className="input mt-1 min-h-24"
          placeholder="The quality and finish exceeded expectations…"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          required
          maxLength={2000}
        />
      </label>
      <div className="flex flex-wrap gap-5 text-sm text-navy-800">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={form.showOnHome} onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })} />
          Show on home
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Published
        </label>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="btn-gold px-6" disabled={busy}>
          {busy ? "Saving…" : "Add testimonial"}
        </button>
        <button
          type="button"
          className="rounded-full border border-[#ddd] px-5 py-2 text-sm font-semibold"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
