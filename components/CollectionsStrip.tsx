"use client";

import Link from "next/link";
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
    <Link href={`/shop?category=${tile.slug}`} className="group w-[5.6rem] shrink-0 text-center sm:w-[7.25rem] lg:w-[8.75rem]">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-[#2a2118] shadow-[0_6px_18px_rgba(26,20,12,0.12)]">
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
          <ProductImage
            src={tile.image}
            alt={tile.name}
            fill
            sizes="140px"
            className="object-cover transition duration-500 group-hover:scale-110"
            style={{ objectPosition: pos }}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[10px] font-medium leading-tight text-[#111] sm:text-[12px] lg:text-[13px]">{tile.name}</p>
    </Link>
  );
}

/** Two rows that keep sliding left to right as the admin adds more collections. */
export function CollectionsStrip({ tiles }: { tiles: CollectionTile[] }) {
  const half = Math.ceil(tiles.length / 2);
  const rows = [tiles.slice(0, half), tiles.slice(half)].filter((row) => row.length > 0);

  return (
    <div className="mt-6 space-y-5">
      {rows.map((row, index) => {
        const track = [...row, ...row];
        return (
          <div key={index} className="overflow-hidden">
            <div
              className="flex w-max gap-3 animate-marquee hover:[animation-play-state:paused]"
              style={{ animationDuration: `${Math.max(24, row.length * 5)}s` }}
            >
              {track.map((tile, i) => (
                <Tile key={`${tile.slug}-${i}`} tile={tile} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
