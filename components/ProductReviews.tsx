"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { ProductReview } from "@/lib/product-reviews";

type Summary = { items: ProductReview[]; count: number; average: number };

/** Shared fetch so the header stars and the Reviews tab show the same numbers. */
export function useProductReviews(slug: string) {
  const [data, setData] = useState<Summary>({ items: [], count: 0, average: 0 });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/product-reviews?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && Array.isArray(json.items)) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug, version]);
  return { ...data, reload: () => setVersion((v) => v + 1) };
}

function Stars({ value, className = "h-3.5 w-3.5" }: { value: number; className?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${className} ${i < Math.round(value) ? "fill-[#222] text-[#222]" : "text-[#ccc]"}`} />
      ))}
    </span>
  );
}

/** Product reviews list plus a star-rating form for signed-in customers. */
export function ProductReviews({
  slug,
  productName,
  reviews,
}: {
  slug: string;
  productName: string;
  reviews: ReturnType<typeof useProductReviews>;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!rating) {
      setError("Choose a star rating.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/product-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug: slug, productName, rating, body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save your review.");
      return;
    }
    setRating(0);
    setBody("");
    setThanks(true);
    reviews.reload();
  }

  return (
    <section className="border-b border-[#eee] pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[18px] font-semibold text-[#222]">Reviews for this item</h2>
        {reviews.count ? (
          <span className="flex items-center gap-2 text-[14px] text-[#595959]">
            <Stars value={reviews.average} />
            {reviews.average.toFixed(1)} · {reviews.count} review{reviews.count === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-[#e6dfd2] bg-[#FAF7F2] p-4">
        {status === "loading" ? null : session?.user ? (
          thanks ? (
            <p className="text-sm text-emerald-700">Thank you! Your review has been posted.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-sm font-medium text-[#222]">
                Write a review as <span className="font-semibold">{session.user.name || session.user.email}</span>
              </p>
              <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = i + 1;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      onMouseEnter={() => setHover(value)}
                      onClick={() => setRating(value)}
                    >
                      <Star
                        className={`h-7 w-7 ${(hover || rating) >= value ? "fill-[#C9A84C] text-[#C9A84C]" : "text-[#bbb]"}`}
                      />
                    </button>
                  );
                })}
                {rating ? <span className="ml-2 text-xs text-navy-600">{rating} of 5</span> : null}
              </div>
              <textarea
                className="input min-h-24 bg-white"
                placeholder="What did you like about this item?"
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <button type="submit" className="btn-gold px-6" disabled={busy}>
                {busy ? "Posting…" : "Post review"}
              </button>
            </form>
          )
        ) : (
          <p className="text-sm text-navy-700">
            <Link href={`/login?callbackUrl=${encodeURIComponent(pathname || `/product/${slug}`)}`} className="font-semibold underline">
              Sign in
            </Link>{" "}
            to rate and review this item.
          </p>
        )}
      </div>

      {reviews.items.length ? (
        <div className="mt-6 space-y-6">
          {reviews.items.map((r) => (
            <article key={r.id} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0B1D36] text-[13px] font-semibold text-[#C9A84C]">
                {r.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-[#222]">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-[#595959]">
                    {" "}
                    on {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </p>
                <div className="mt-1">
                  <Stars value={r.rating} />
                </div>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[#222]">{r.body}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#595959]">No reviews for this item yet. Be the first to review it.</p>
      )}
    </section>
  );
}
