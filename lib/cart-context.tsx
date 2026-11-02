"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { B2B_MIN_ORDER_QTY, products, type Product } from "./products";
import { regionalPrice, type PriceRegion } from "./region";
import { useRegion } from "./region-context";

export type CartLine = {
  slug: string;
  qty: number;
  b2b?: boolean;
  personalisation?: "yes" | "no";
  message?: string;
  personalisationPrice?: number;
  name?: string;
  price?: number;
  priceIndia?: number;
  priceUs?: number;
  image?: string;
};

const minQty = (line: Pick<CartLine, "b2b">) => (line.b2b ? B2B_MIN_ORDER_QTY : 1);
const normalize = (line: CartLine): CartLine => ({ ...line, qty: Math.max(minQty(line), line.qty) });

type CartItem = {
  product: Product;
  qty: number;
  b2b: boolean;
  personalisation?: "yes" | "no";
  message?: string;
  unitPrice: number;
};

type AddOptions = {
  b2b?: boolean;
  personalisation?: "yes" | "no";
  message?: string;
  personalisationPrice?: number;
  name?: string;
  price?: number;
  priceIndia?: number;
  priceUs?: number;
  image?: string;
};

type CartContextValue = {
  lines: CartLine[];
  add: (slug: string, qty?: number, opts?: AddOptions) => void;
  remove: (slug: string, line?: { personalisation?: "yes" | "no"; message?: string }) => void;
  setQty: (slug: string, qty: number, line?: { personalisation?: "yes" | "no"; message?: string }) => void;
  clear: () => void;
  count: number;
  items: CartItem[];
  subtotal: number;
  /** "Buy now" checks out a single product without touching the bag. */
  buyNow: (slug: string, qty?: number, opts?: AddOptions) => void;
  clearBuyNow: () => void;
  buyNowLines: CartLine[];
  buyNowItems: CartItem[];
  buyNowSubtotal: number;
};

function makeLine(slug: string, qty: number, opts?: AddOptions): CartLine {
  const personalisation = opts?.personalisation === "yes" || opts?.personalisation === "no" ? opts.personalisation : undefined;
  return normalize({
    slug,
    qty,
    b2b: Boolean(opts?.b2b),
    personalisation,
    message: personalisation === "yes" ? opts?.message?.trim().slice(0, 300) : undefined,
    personalisationPrice: opts?.personalisationPrice,
    name: opts?.name,
    price: opts?.price,
    priceIndia: opts?.priceIndia,
    priceUs: opts?.priceUs,
    image: opts?.image,
  });
}

/** Same key the server quote uses for a bag line. */
function quoteKey(line: { slug: string; b2b?: boolean; personalisation?: string }) {
  return `${line.slug}|${line.b2b ? 1 : 0}|${line.personalisation ?? ""}`;
}

function toItems(lines: CartLine[], region: PriceRegion, live: Record<string, number>): CartItem[] {
  const items: CartItem[] = [];
  for (const l of lines) {
    const found = productFromLine(l);
    if (!found) continue;
    // Price for the visitor's location (India, United States or everywhere else).
    const product = { ...found, price: regionalPrice(found, region) };
    // The server quote (live listing, wholesale price, active sale) wins over anything stored in the browser.
    const quoted = live[quoteKey(l)];
    items.push({
      product: quoted != null ? { ...product, price: quoted - (unitPrice(product, l) - product.price) } : product,
      qty: l.qty,
      b2b: Boolean(l.b2b),
      personalisation: l.personalisation,
      message: l.message,
      unitPrice: quoted != null ? quoted : unitPrice(product, l),
    });
  }
  return items;
}

function productFromLine(line: CartLine): Product | undefined {
  const found = products.find((p) => p.slug === line.slug);
  // Prices captured from the live listing when the item was added beat the old built-in catalogue.
  if (found && line.price != null) {
    return { ...found, name: line.name || found.name, price: line.price, priceIndia: line.priceIndia, priceUs: line.priceUs, image: line.image || found.image };
  }
  if (found) return found;
  if (!line.name || line.price == null) return undefined;
  return {
    slug: line.slug,
    name: line.name,
    sku: line.slug,
    price: line.price,
    priceIndia: line.priceIndia,
    priceUs: line.priceUs,
    rating: 0,
    reviews: 0,
    stock: "in-stock",
    collection: "new-arrivals",
    image: line.image || "/newlogo.png",
    gallery: line.image ? [line.image] : [],
    finish: "",
    material: "",
    dimensions: "",
    weight: "",
    packaging: "",
    included: [],
    description: line.name,
    story: "",
    personalisationPrice: line.personalisationPrice,
  };
}

function sameLine(
  item: CartLine,
  slug: string,
  line?: { personalisation?: "yes" | "no"; message?: string }
) {
  if (item.slug !== slug) return false;
  if (!line) return true;
  return item.personalisation === line.personalisation && (item.message ?? "") === (line.message ?? "");
}

function unitPrice(product: Product, line: CartLine) {
  const charge =
    line.personalisation === "yes"
      ? Number(line.personalisationPrice ?? product.personalisationPrice ?? 0) || 0
      : 0;
  return product.price + charge;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "marina-muse-cart";
const BUY_NOW_KEY = "marina-muse-buy-now";

export function CartProvider({ children }: { children: ReactNode }) {
  const { region } = useRegion();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [buyNowLine, setBuyNowLine] = useState<CartLine | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines((JSON.parse(raw) as CartLine[]).map(normalize));
      const buy = sessionStorage.getItem(BUY_NOW_KEY);
      if (buy) setBuyNowLine(normalize(JSON.parse(buy) as CartLine));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* Checkout remains usable when browser storage is blocked or full. */
    }
  }, [lines, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (buyNowLine) sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(buyNowLine));
      else sessionStorage.removeItem(BUY_NOW_KEY);
    } catch {
      /* ignore */
    }
  }, [buyNowLine, ready]);

  // Re-price the bag from the server whenever its contents or the visitor's region change.
  const quoteLines = JSON.stringify(
    [...lines, ...(buyNowLine ? [buyNowLine] : [])].map((l) => ({ slug: l.slug, b2b: Boolean(l.b2b), personalisation: l.personalisation }))
  );
  useEffect(() => {
    if (!ready) return;
    const wanted = JSON.parse(quoteLines) as { slug: string; b2b: boolean; personalisation?: string }[];
    if (!wanted.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: wanted.map((l) => ({ ...l, qty: 1 })) }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { items?: { slug: string; b2b: boolean; personalisation?: string; unitPrice: number | null }[] } | null) => {
          if (!data?.items) return;
          const next: Record<string, number> = {};
          for (const item of data.items) if (item.unitPrice != null) next[quoteKey(item)] = item.unitPrice;
          setLive(next);
        })
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [quoteLines, ready, region]);

  const value = useMemo<CartContextValue>(() => {
    const items = toItems(lines, region, live);
    const buyNowLines = buyNowLine ? [buyNowLine] : [];
    const buyNowItems = toItems(buyNowLines, region, live);
    return {
      lines,
      add: (slug, qty = 1, opts) =>
        setLines((prev) => {
          const next = makeLine(slug, qty, opts);
          const found = prev.find(
            (l) => l.slug === slug && l.personalisation === next.personalisation && (l.message ?? "") === (next.message ?? "")
          );
          if (found) {
            return prev.map((l) =>
              l === found ? normalize({ ...l, b2b: l.b2b || next.b2b, qty: l.qty + qty }) : l
            );
          }
          return [...prev, next];
        }),
      buyNow: (slug, qty = 1, opts) => setBuyNowLine(makeLine(slug, qty, opts)),
      clearBuyNow: () => setBuyNowLine(null),
      buyNowLines,
      buyNowItems,
      buyNowSubtotal: buyNowItems.reduce((n, i) => n + i.unitPrice * i.qty, 0),
      remove: (slug, line) =>
        setLines((prev) => prev.filter((item) => !sameLine(item, slug, line))),
      setQty: (slug, qty, line) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((item) => !sameLine(item, slug, line))
            : prev.map((item) => (sameLine(item, slug, line) ? normalize({ ...item, qty }) : item))
        ),
      clear: () => setLines([]),
      count: items.reduce((n, i) => n + i.qty, 0),
      items,
      subtotal: items.reduce((n, i) => n + i.unitPrice * i.qty, 0),
    };
  }, [lines, buyNowLine, region, live]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
