"use client";

import { showsFreeShipping, type Product } from "@/lib/products";
import { imageAdjustStyle, lowStockMessage } from "@/lib/product-display";
import { useWishlist } from "@/lib/wishlist-context";
import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ImageOverlayText } from "./ImageOverlayText";
import { FreeShippingTag } from "./FreeShippingTag";
import { PriceRow } from "./PriceRow";
import { ProductName } from "./ProductName";

export function ProductCard({ product }: { product: Product }) {
  const { has, toggle } = useWishlist();
  const wished = has(product.slug);
  const availabilityMessage = product.b2cOutOfStock
    ? "Out of stock"
    : lowStockMessage(product.quantity);

  return (
    <article className="group flex flex-col bg-white">
      <div className="relative aspect-square overflow-hidden rounded-[4px] bg-[#f5f5f5]">
        <Link href={`/product/${product.slug}`} className="relative block h-full">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            style={imageAdjustStyle(product.imageAdjust)}
          />
          <ImageOverlayText
            text={product.listingImages?.[0]?.text}
            x={product.listingImages?.[0]?.textX}
            y={product.listingImages?.[0]?.textY}
          />
        </Link>
        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(product.slug);
          }}
          className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center text-[#222222]"
        >
          <Heart className={`h-[22px] w-[22px] ${wished ? "fill-[#222222] text-[#222222]" : ""}`} />
        </button>
      </div>
      <Link href={`/product/${product.slug}`} className="mt-2 block min-w-0" aria-label={product.name}>
        <h3>
          <ProductName name={product.name} className="text-[14px] font-normal leading-[1.35] text-[#222222]" />
        </h3>
      </Link>
      <PriceRow price={product.price} className="mt-1" />
      {availabilityMessage ? (
        <p className="mt-1 text-[12px] font-medium text-[#9a3412]">{availabilityMessage}</p>
      ) : null}
      {showsFreeShipping(product) ? <FreeShippingTag /> : null}
    </article>
  );
}
