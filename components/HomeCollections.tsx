import { getProductCategory } from "@/lib/catalog";
import { img } from "@/lib/images";
import { products } from "@/lib/products";
import { shopNowTree } from "@/lib/shop-now-data";
import Image from "next/image";
import Link from "next/link";

type TileArt = { image: string; pos?: string; origin?: string; zoom?: number };

const tileArt: Record<string, TileArt> = {
  "brass-binocular": { image: "/contact-us-slide.jpeg", pos: "50% 70%", zoom: 1.5 },
  "brass-spyglass-telescope": { image: "/1-slide.jpeg", pos: "62% 85%", zoom: 1.6 },
  "brass-telescope-stand": { image: "/custom-manufacturing-hero.jpg", pos: "100% 50%" },
  "brass-binocular-tripod": { image: "/custom-manufacturing-hero.jpg", pos: "25% 50%", origin: "100% 87%", zoom: 1.6 },
  "brass-lamp-tripod": { image: "/about-us-slide.jpeg", pos: "75% 50%" },
  "wooden-ship-wheel": { image: "/5-slide.jpeg", pos: "68% 0%", zoom: 2 },
  "royal-lamp-tripod": { image: "/3-slide.jpeg", pos: "100% 0%", zoom: 1.6 },
  "armor-breast-plate": { image: "/2-slide.jpeg", pos: "100% 50%" },
  "armor-helmets": { image: "/2-slide.jpeg", pos: "72% 75%", zoom: 1.5 },
  "muscle-armour": { image: img.knight },
  "armory-props": { image: img.helmet },
  compass: { image: img.compassGold },
  "spotlight-searchlight": { image: img.lanternVintage },
  clocks: { image: img.watch },
  "ship-bell": { image: "/5-slide.jpeg", pos: "100% 50%" },
  "nautical-decor-gifts": { image: "/about-us-slide.jpeg", pos: "100% 50%" },
  "kitchen-product": { image: "/3-slide.jpeg", pos: "75% 50%", origin: "55% 85%", zoom: 1.5 },
  decor: { image: "/contact-us-slide.jpeg", pos: "75% 50%" },
  jewellery: { image: img.jewelry },
  hardware: { image: "/foundry.jpeg" },
  "modern-brass-wall-sconce": { image: "/sconce-dome.jpg" },
  "lighting-lamps": { image: img.lightChandelier },
};

const categories = shopNowTree.flatMap((c) => {
  if (c.slug === "brass-telescope-tripod") return [];
  const fallback = products.find((p) => getProductCategory(p) === c.slug);
  const art = tileArt[c.slug] ?? (fallback && { image: fallback.image });
  return art ? [{ slug: c.slug, name: c.name, ...art }] : [];
});

const half = Math.ceil(categories.length / 2);
const firstRow = categories.slice(0, half);
const secondRow = categories.slice(half);

function CategoryTile({
  slug,
  name,
  image,
  pos = "50% 50%",
  origin = pos,
  zoom = 1,
  className = "",
}: {
  slug: string;
  name: string;
  image: string;
  pos?: string;
  origin?: string;
  zoom?: number;
  className?: string;
}) {
  return (
    <Link href={`/shop?category=${slug}`} className={`group text-center ${className}`}>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-[#2a2118] shadow-[0_6px_18px_rgba(26,20,12,0.12)] lg:rounded-xl lg:shadow-[0_8px_24px_rgba(26,20,12,0.12)]">
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
          <Image
            src={image}
            alt={name}
            fill
            sizes={zoom > 1 ? "(max-width: 1024px) 40vw, 20vw" : "(max-width: 1024px) 20vw, 9vw"}
            className="object-cover transition duration-500 group-hover:scale-110"
            style={{ objectPosition: pos }}
          />
        </div>
      </div>
      <p className="mt-1.5 min-h-[2.5em] text-[10px] font-medium leading-tight text-[#111] sm:text-[12px] lg:mt-2.5 lg:min-h-0 lg:text-[13px]">{name}</p>
    </Link>
  );
}

export function HomeCollections() {
  return (
    <section className="px-5 pb-6 pt-4 md:pb-8 md:pt-5">
      <div className="mx-auto max-w-[1320px]">
        <h2 className="text-center font-serif text-[1.75rem] text-[#000] md:text-[2.85rem]">
          Explore Our Collections
        </h2>

        <div className="-mx-5 mt-6 space-y-5 lg:hidden">
          {[firstRow, secondRow].map((row, r) => (
            <div
              key={r}
              className="no-scrollbar grid snap-x snap-mandatory auto-cols-[calc((100%-56px)/5)] grid-flow-col gap-x-2 overflow-x-auto scroll-px-4 px-4"
            >
              {row.map((c) => (
                <CategoryTile key={c.slug} {...c} className="block snap-start" />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-8 hidden space-y-6 lg:block">
          {[firstRow, secondRow].map((row, r) => (
            <div key={r} className="grid gap-x-3" style={{ gridTemplateColumns: `repeat(${half}, minmax(0, 1fr))` }}>
              {row.map((c) => (
                <CategoryTile key={c.slug} {...c} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
