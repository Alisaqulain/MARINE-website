import { getProductCategory } from "@/lib/catalog";
import { CollectionsStrip, type CollectionTile } from "@/components/CollectionsStrip";
import { img } from "@/lib/images";
import { products } from "@/lib/products";
import { loadCategoryCatalog } from "@/lib/shop-categories";
import { shopNowTree } from "@/lib/shop-now-data";

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

const DEFAULT_TILE = "/contact-us-slide.jpeg";

function collectionTiles(nodes: { slug: string; name: string; image?: string }[]): CollectionTile[] {
  const seen = new Set<string>();
  return nodes.flatMap((c) => {
    if (c.slug === "brass-telescope-tripod" || seen.has(c.slug)) return [];
    seen.add(c.slug);
    const fallback = products.find(
      (p) => getProductCategory(p) === c.slug || p.category === c.slug || p.categories?.includes(c.slug)
    );
    const art = tileArt[c.slug] ?? (fallback ? { image: fallback.image } : { image: DEFAULT_TILE });
    const uploaded = c.image?.trim();
    return [
      {
        slug: c.slug,
        name: c.name,
        image: uploaded || art.image,
        pos: uploaded ? "50% 50%" : art.pos,
        origin: uploaded ? "50% 50%" : art.origin,
        zoom: uploaded ? 1 : art.zoom,
      },
    ];
  });
}

export async function HomeCollections() {
  let nodes: { slug: string; name: string; image?: string }[] = shopNowTree.map((c) => ({ slug: c.slug, name: c.name }));
  const catalog = await loadCategoryCatalog();
  if (catalog.tree.length) {
    nodes = catalog.tree.map((c) => ({ slug: c.slug, name: c.name, image: c.image }));
  }

  return (
    <section className="overflow-hidden px-5 pb-6 pt-4 md:pb-8 md:pt-5">
      <div className="mx-auto max-w-[1320px]">
        <h2 className="text-center font-serif text-[1.75rem] text-[#000] md:text-[2.85rem]">Explore Our Collections</h2>
        <CollectionsStrip tiles={collectionTiles(nodes)} />
      </div>
    </section>
  );
}
