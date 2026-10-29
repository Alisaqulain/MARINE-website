"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";

export type CollectionTile = {
  slug: string;
  name: string;
  image: string;
  pos?: string;
  origin?: string;
  zoom?: number;
};

function Tile({ tile }: { tile: CollectionTile }) {
  const pos = tile.pos ?? "50% 50%";
  const origin = tile.origin ?? pos;
  const zoom = tile.zoom ?? 1;
  return (
    <Link href={`/retail?category=${tile.slug}`} className="group w-[5.6rem] text-center">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-[#2a2118] shadow-[0_6px_18px_rgba(26,20,12,0.12)]">
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
          <ProductImage
            src={tile.image}
            alt={tile.name}
            fill
            sizes="90px"
            className="object-cover transition duration-500 group-hover:scale-110"
            style={{ objectPosition: pos }}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[10px] font-medium leading-tight text-[#111]">{tile.name}</p>
    </Link>
  );
}

/** Manual collection slider — two rows, scrolls sideways. */
export function CollectionsStrip({ tiles }: { tiles: CollectionTile[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(180, el.clientWidth * 0.75), behavior: "smooth" });
  }

  return (
    <div className="relative mt-6">
      <button
        type="button"
        aria-label="Previous collections"
        onClick={() => move(-1)}
        className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#e6dfd2] bg-white text-[#031D38] shadow-sm"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Next collections"
        onClick={() => move(1)}
        className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#e6dfd2] bg-white text-[#031D38] shadow-sm"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      <div
        ref={scroller}
        className="no-scrollbar grid auto-cols-[5.6rem] grid-flow-col grid-rows-2 gap-x-3 gap-y-4 overflow-x-auto scroll-smooth px-10"
      >
        {tiles.map((tile) => (
          <Tile key={tile.slug} tile={tile} />
        ))}
      </div>
    </div>
  );
}
