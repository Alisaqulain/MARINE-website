"use client";

import { ProductCard } from "@/components/ProductCard";
import { useWishlist } from "@/lib/wishlist-context";
import Link from "next/link";

export default function WishlistPage() {
  const { items } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-serif text-3xl md:text-5xl">Your wishlist is empty</h1>
        <p className="mt-3 text-navy-600">Tap the heart on any product image to save it here.</p>
        <Link href="/retail" className="btn-gold mt-8">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-12">
      <h1 className="font-serif text-3xl md:text-4xl">Wishlist</h1>
      <p className="mt-2 text-sm text-navy-600">{items.length} saved piece{items.length === 1 ? "" : "s"}</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
