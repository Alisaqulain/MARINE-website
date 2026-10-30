"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { resolveMediaUrl } from "@/lib/media-url";
import type { ProductReview } from "@/lib/product-reviews";

/** Customer star ratings and reviews left on product pages, with the reviewer's account name. */
export function AdminProductReviewsPanel({ canDelete }: { canDelete: boolean }) {
  const [rows, setRows] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [replyError, setReplyError] = useState("");

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

  function openReply(review: ProductReview) {
    setReplyingTo(review.id);
    setReplyDraft(review.reply ?? "");
    setReplyError("");
  }

  async function saveReply(id: string, text: string) {
    setSavingReply(true);
    setReplyError("");
    const res = await fetch("/api/admin/product-reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reply: text }),
    });
    setSavingReply(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setReplyError(typeof data.error === "string" ? data.error : "Could not save the reply.");
      return;
    }
    setReplyingTo(null);
    void load();
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
        reviews are hidden everywhere. Replies appear under the review on the product page.
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
                <Fragment key={r.id}>
                <tr className={`align-top ${replyingTo === r.id ? "" : "border-b border-[#f0ebe3]"}`}>
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
                    {r.images?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.images.map((src, i) => (
                          <a
                            key={src}
                            href={resolveMediaUrl(src) || src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block h-12 w-12 overflow-hidden rounded border border-[#e8dfd0] bg-[#f4f1ea]"
                          >
                            <ProductImage src={src} alt={`Photo ${i + 1}`} fill sizes="48px" className="object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {r.reply ? (
                      <p className="mt-2 border-l-2 border-[#C9A84C] pl-2 text-xs text-navy-600">
                        <span className="font-semibold text-navy-800">Your reply: </span>
                        <span className="whitespace-pre-line">{r.reply}</span>
                      </p>
                    ) : null}
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
                    <div className="flex flex-col items-start gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#8C6E28] underline"
                        onClick={() => (replyingTo === r.id ? setReplyingTo(null) : openReply(r))}
                      >
                        {r.reply ? "Edit reply" : "Reply"}
                      </button>
                      {canDelete ? (
                        <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => void remove(r.id)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {replyingTo === r.id ? (
                  <tr className="border-b border-[#f0ebe3] bg-[#FAF7F2]">
                    <td colSpan={8} className="px-4 py-4">
                      <label className="block text-xs font-semibold text-navy-800">
                        Reply to {r.name} (shown publicly as &quot;Response from Marina Muse&quot;)
                        <textarea
                          className="input mt-2 min-h-20 bg-white font-normal"
                          maxLength={2000}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Thank you for your kind words…"
                          autoFocus
                        />
                      </label>
                      {replyError ? <p className="mt-2 text-sm text-red-700">{replyError}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-gold px-5 py-2 text-xs"
                          disabled={savingReply || !replyDraft.trim()}
                          onClick={() => void saveReply(r.id, replyDraft)}
                        >
                          {savingReply ? "Saving…" : "Save reply"}
                        </button>
                        {r.reply ? (
                          <button
                            type="button"
                            className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700"
                            disabled={savingReply}
                            onClick={() => void saveReply(r.id, "")}
                          >
                            Remove reply
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-full border border-[#ddd] px-4 py-2 text-xs font-semibold"
                          onClick={() => setReplyingTo(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
