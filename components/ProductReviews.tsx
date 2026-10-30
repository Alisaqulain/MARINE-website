"use client";

import { ImagePlus, Star, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { resolveMediaUrl } from "@/lib/media-url";
import type { ProductReview } from "@/lib/product-reviews";

const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 5;

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

function ReviewPhotos({ images }: { images: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.map((src, i) => (
        <a
          key={src}
          href={resolveMediaUrl(src) || src}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block h-20 w-20 overflow-hidden rounded-md border border-[#e6dfd2] bg-[#f4f1ea]"
        >
          <ProductImage src={src} alt={`Customer photo ${i + 1}`} fill sizes="80px" className="object-cover" />
        </a>
      ))}
    </div>
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
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function addPhotos(list: FileList | null) {
    setError("");
    const picked = Array.from(list ?? []);
    const tooBig = picked.some((file) => file.size > MAX_PHOTO_MB * 1024 * 1024);
    const ok = picked.filter((file) => file.type.startsWith("image/") && file.size <= MAX_PHOTO_MB * 1024 * 1024);
    if (tooBig) setError(`Each photo must be under ${MAX_PHOTO_MB} MB.`);
    if (photos.length + ok.length > MAX_PHOTOS) setError(`You can attach up to ${MAX_PHOTOS} photos.`);
    const room = ok.slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    if (room.length) {
      setPhotos((prev) => [...prev, ...room.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!rating) {
      setError("Choose a star rating.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("productSlug", slug);
    form.append("productName", productName);
    form.append("rating", String(rating));
    form.append("body", body);
    photos.forEach((p) => form.append("images", p.file));
    const res = await fetch("/api/product-reviews", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save your review.");
      return;
    }
    setRating(0);
    setBody("");
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
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
              <div className="flex flex-wrap items-center gap-2">
                {photos.map((p, i) => (
                  <span key={p.preview} className="relative h-16 w-16 overflow-hidden rounded-md border border-[#e6dfd2] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img src={p.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => removePhoto(i)}
                      className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {photos.length < MAX_PHOTOS ? (
                  <label className="flex h-16 cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#c9bfae] bg-white px-3 text-xs text-navy-700 hover:border-[#C9A84C]">
                    <ImagePlus className="h-5 w-5" />
                    Add photos
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="sr-only"
                      onChange={(e) => addPhotos(e.target.files)}
                    />
                  </label>
                ) : null}
                <span className="text-[11px] text-navy-500">
                  Optional · up to {MAX_PHOTOS} photos, {MAX_PHOTO_MB} MB each
                </span>
              </div>
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
                {r.images?.length ? <ReviewPhotos images={r.images} /> : null}
                {r.reply ? (
                  <div className="mt-4 flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0B1D36] text-[11px] font-semibold text-[#C9A84C]">
                      M
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#222]">Response from Marina Muse</p>
                      <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-[#333]">{r.reply}</p>
                    </div>
                  </div>
                ) : null}
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
