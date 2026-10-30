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
    <Link href={`/retail?category=${tile.slug}`} className="group w-[6.5rem] shrink-0 sm:w-[7.5rem] snap-start text-center">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-[#2a2118] shadow-[0_6px_18px_rgba(26,20,12,0.12)]">
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
          <ProductImage
            src={tile.image}
            alt={tile.name}
            fill
            sizes="120px"
            className="object-cover transition duration-500 group-hover:scale-110"
            style={{ objectPosition: pos }}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] font-medium leading-tight text-[#3A6EA5]">{tile.name}</p>
    </Link>
  );
}

function ScrollRow({
  tiles,
  showArrows,
}: {
  tiles: CollectionTile[];
  showArrows: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(180, el.clientWidth * 0.75), behavior: "smooth" });
  }

  if (!tiles.length) return null;

  return (
    <div className="relative">
      {showArrows ? (
        <>
          <button
            type="button"
            aria-label="Previous collections"
            onClick={() => move(-1)}
            className="absolute left-0 top-[3.75rem] z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#e6dfd2] bg-white text-[#031D38] shadow-sm sm:flex"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next collections"
            onClick={() => move(1)}
            className="absolute right-0 top-[3.75rem] z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#e6dfd2] bg-white text-[#031D38] shadow-sm sm:flex"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </>
      ) : null}
      <div
        ref={scroller}
        className={`no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth ${showArrows ? "sm:px-10" : "px-0"} px-1`}
      >
        {tiles.map((tile) => (
          <Tile key={tile.slug} tile={tile} />
        ))}
      </div>
    </div>
  );
}

/** Two independent rows — each scrolls on its own. Arrows only on desktop. */
export function CollectionsStrip({ tiles }: { tiles: CollectionTile[] }) {
  const mid = Math.ceil(tiles.length / 2);
  const top = tiles.slice(0, mid);
  const bottom = tiles.slice(mid);

  return (
    <div className="mt-6 space-y-4">
      <ScrollRow tiles={top} showArrows />
      <ScrollRow tiles={bottom} showArrows />
    </div>
  );
}
