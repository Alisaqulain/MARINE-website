import { CollectionsStrip, type CollectionTile } from "@/components/CollectionsStrip";
import { getProductCategory } from "@/lib/catalog";
import { img } from "@/lib/images";
import { products } from "@/lib/products";
import { loadCategoryCatalog } from "@/lib/shop-categories";
import { shopNowTree } from "@/lib/shop-now-data";
import Image from "next/image";
import Link from "next/link";

const tileArt: Record<string, { image: string; pos?: string }> = {
  "brass-binocular": { image: "/contact-us-slide.jpeg", pos: "50% 70%" },
  "brass-spyglass-telescope": { image: "/1-slide.jpeg", pos: "62% 85%" },
  "brass-telescope-stand": { image: "/custom-manufacturing-hero.jpg", pos: "100% 50%" },
  "brass-binocular-tripod": { image: "/custom-manufacturing-hero.jpg", pos: "25% 50%" },
  "brass-lamp-tripod": { image: "/about-us-slide.jpeg", pos: "75% 50%" },
  "wooden-ship-wheel": { image: "/5-slide.jpeg", pos: "68% 0%" },
  "royal-lamp-tripod": { image: "/3-slide.jpeg", pos: "100% 0%" },
  "armor-breast-plate": { image: "/2-slide.jpeg", pos: "100% 50%" },
  "armor-helmets": { image: "/2-slide.jpeg", pos: "72% 75%" },
  "muscle-armour": { image: img.knight },
  "armory-props": { image: img.helmet },
  compass: { image: img.compassGold },
  "spotlight-searchlight": { image: img.lanternVintage },
  clocks: { image: img.watch },
  "ship-bell": { image: "/5-slide.jpeg", pos: "100% 50%" },
  "nautical-decor-gifts": { image: "/about-us-slide.jpeg", pos: "100% 50%" },
  "kitchen-product": { image: "/3-slide.jpeg", pos: "75% 50%" },
  decor: { image: "/contact-us-slide.jpeg", pos: "75% 50%" },
  jewellery: { image: img.jewelry },
  hardware: { image: "/foundry.jpeg" },
  "modern-brass-wall-sconce": { image: "/sconce-dome.jpg" },
  "lighting-lamps": { image: img.lightChandelier },
};

function collectionTiles(nodes: { slug: string; name: string; image?: string }[]): CollectionTile[] {
  const seen = new Set<string>();
  return nodes.flatMap((c) => {
    if (c.slug === "brass-telescope-tripod" || seen.has(c.slug)) return [];
    seen.add(c.slug);
    const fallback = products.find(
      (p) => getProductCategory(p) === c.slug || p.category === c.slug || p.categories?.includes(c.slug)
    );
    const art = tileArt[c.slug] ?? (fallback ? { image: fallback.image } : { image: "/contact-us-slide.jpeg" });
    const uploaded = c.image?.trim();
    return [
      {
        slug: c.slug,
        name: c.name,
        image: uploaded || art.image,
        pos: uploaded ? "50% 50%" : art.pos,
      },
    ];
  });
}

export default async function CollectionsPage() {
  let nodes: { slug: string; name: string; image?: string }[] = shopNowTree.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));
  const catalog = await loadCategoryCatalog();
  if (catalog.tree.length) {
    nodes = catalog.tree.map((c) => ({ slug: c.slug, name: c.name, image: c.image }));
  }
  const tiles = collectionTiles(nodes);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <p className="text-xs uppercase tracking-[0.3em] text-gold-700">Worlds of brass</p>
      <h1 className="mt-2 font-serif text-3xl text-navy-900 md:text-5xl">Collections</h1>
      <p className="mt-3 max-w-2xl text-navy-600">
        The same Explore Our Collections families from the homepage — kept in sync with the admin category list.
      </p>

      <div className="mt-8 md:hidden">
        <CollectionsStrip tiles={tiles} />
      </div>

      <div className="mt-8 hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.slug}
            href={`/retail?category=${tile.slug}`}
            className="group relative min-h-[220px] overflow-hidden rounded-3xl"
          >
            <Image
              src={tile.image}
              alt={tile.name}
              fill
              className="object-cover transition duration-700 group-hover:scale-105"
              style={tile.pos ? { objectPosition: tile.pos } : undefined}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-950/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-cream-50">
              <h2 className="font-serif text-2xl">{tile.name}</h2>
              <p className="mt-1 text-sm text-cream-100/80">Shop this collection →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
