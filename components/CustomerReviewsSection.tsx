"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";

type Review = {
  id: string;
  title: string;
  body: string;
  name: string;
  location: string;
  product: string;
  /** Set for customer product reviews; shown as stars instead of a title. */
  rating?: number;
  productSlug?: string;
};

type ProductReviewItem = {
  id: string;
  productSlug: string;
  productName: string;
  rating: number;
  body: string;
  name: string;
};

export function CustomerReviewsSection() {
  const t = useT();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Both admin "Show on home" lists: customer product reviews first, then shop testimonials.
    Promise.all([
      fetch("/api/product-reviews?home=1")
        .then((r) => r.json())
        .catch(() => ({ items: [] })),
      fetch("/api/testimonials?home=1")
        .then((r) => r.json())
        .catch(() => ({ items: [] })),
    ])
      .then(([productData, testimonialData]) => {
        const fromProducts: Review[] = (Array.isArray(productData.items) ? productData.items : []).map(
          (r: ProductReviewItem) => ({
            id: `product-${r.id}`,
            title: "",
            body: r.body,
            name: r.name,
            location: "",
            product: r.productName,
            rating: r.rating,
            productSlug: r.productSlug,
          })
        );
        const testimonials: Review[] = Array.isArray(testimonialData.items) ? testimonialData.items : [];
        setReviews([...fromProducts, ...testimonials]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-[#F4F1EA] px-5 py-10 md:py-14">
      <div className="mx-auto max-w-[1320px]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-px w-16 bg-[#C9A84C]" />
          <h2 className="whitespace-nowrap font-serif text-[clamp(1.5rem,7.4vw,2.25rem)] text-navy-900 md:text-5xl">
            {t("home.reviews.title")}
          </h2>
        </div>
        {loading ? (
          <p className="mt-8 text-center text-sm text-navy-600">Loading reviews…</p>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {reviews.map((r) => (
              <blockquote
                key={r.id}
                className="rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(26,20,12,0.06)] md:p-8"
              >
                {r.rating ? (
                  <p className="flex items-center gap-1" aria-label={`${r.rating} of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${i < r.rating! ? "fill-[#C9A84C] text-[#C9A84C]" : "text-[#d8d2c6]"}`}
                      />
                    ))}
                  </p>
                ) : (
                  <p className="font-serif text-xl text-navy-900 md:text-2xl">“{r.title}”</p>
                )}
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-navy-700">{r.body}</p>
                <p className="mt-6 text-sm font-medium text-navy-900">
                  {r.name}
                  {r.location ? ` · ${r.location}` : ""}
                </p>
                {r.productSlug ? (
                  <Link href={`/product/${r.productSlug}`} className="text-xs text-[#8C6E28] hover:underline">
                    {r.product}
                  </Link>
                ) : (
                  <p className="text-xs text-[#8C6E28]">{r.product}</p>
                )}
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
