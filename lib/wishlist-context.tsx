"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { products as staticProducts, type Product } from "./products";

type WishlistContextValue = {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
  count: number;
  items: Product[];
};

/** Logs a heart tap so admin Listing stats can count favourites. Best-effort. */
function logFavourite(slug: string, action: "add" | "remove") {
  let visitorId = "";
  try {
    visitorId = localStorage.getItem("marina-visitor-id") ?? "";
  } catch {
    /* ignore */
  }
  void fetch("/api/favourites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, action, visitorId }),
    keepalive: true,
  }).catch(() => {});
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const KEY = "marina-muse-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>(staticProducts);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSlugs(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(slugs));
  }, [slugs, ready]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/catalog/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.items) && data.items.length) {
          setCatalog(data.items);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<WishlistContextValue>(
    () => ({
      slugs,
      toggle: (slug) => {
        logFavourite(slug, slugs.includes(slug) ? "remove" : "add");
        setSlugs((prev) =>
          prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
        );
      },
      has: (slug) => slugs.includes(slug),
      count: slugs.length,
      items: slugs
        .map((slug) => catalog.find((p) => p.slug === slug) ?? staticProducts.find((p) => p.slug === slug))
        .filter((p): p is Product => Boolean(p)),
    }),
    [slugs, catalog]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
