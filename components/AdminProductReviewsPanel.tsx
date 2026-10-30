"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ProductReview } from "@/lib/product-reviews";

/** Customer star ratings and reviews left on product pages, with the reviewer's account name. */
export function AdminProductReviewsPanel({ canDelete }: { canDelete: boolean }) {
  const [rows, setRows] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetch("/api/admin/product-reviews", { cache: "no-store" })
      .then((res) => res.json())
      .catch(() => ({}));
    setRows(Array.isArray(data.items) ? data.items : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setFlags(id: string, flags: { published?: boolean; showOnHome?: boolean }) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...flags } : r)));
    await fetch("/api/admin/product-reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...flags }),
    });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this review permanently?")) return;
    await fetch(`/api/admin/product-reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    void load();
  }

  return (
    <div>
      <h2 className="font-serif text-lg text-navy-900">Product reviews ({rows.length})</h2>
      <p className="mb-3 mt-1 text-xs text-navy-600">
        Tick &quot;Show on home&quot; to feature a review in &quot;What Our Customers Say&quot; on the home page. Unpublished
        reviews are hidden everywhere.
      </p>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Show on home</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-navy-600">
                  Loading reviews…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-navy-600">
                  No product reviews yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f0ebe3] align-top">
                  <td className="max-w-[14rem] px-4 py-3">
                    <Link href={`/product/${r.productSlug}`} target="_blank" className="line-clamp-2 underline">
                      {r.productName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.name}</span>
                    {r.email ? <span className="block text-xs text-navy-500">{r.email}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-0.5" aria-label={`${r.rating} of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-[#C9A84C] text-[#C9A84C]" : "text-[#ccc]"}`} />
                      ))}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-navy-800">
                    <p className="line-clamp-3 whitespace-pre-line">{r.body}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-navy-600">
                    {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={r.showOnHome}
                        onChange={(e) => void setFlags(r.id, { showOnHome: e.target.checked })}
                      />
                      {r.showOnHome ? "Visible" : "Hidden"}
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={r.published}
                        onChange={(e) => void setFlags(r.id, { published: e.target.checked })}
                      />
                      {r.published ? "Yes" : "No"}
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {canDelete ? (
                      <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => void remove(r.id)}>
                        Delete
                      </button>
                    ) : (
                      "—"
                    )}
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
