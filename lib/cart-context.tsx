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

export type CartLine = {
  slug: string;
  qty: number;
  b2b?: boolean;
  personalisation?: "yes" | "no";
  message?: string;
  personalisationPrice?: number;
  name?: string;
  price?: number;
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

type CartContextValue = {
  lines: CartLine[];
  add: (
    slug: string,
    qty?: number,
    opts?: {
      b2b?: boolean;
      personalisation?: "yes" | "no";
      message?: string;
      personalisationPrice?: number;
      name?: string;
      price?: number;
      image?: string;
    }
  ) => void;
  remove: (slug: string, line?: { personalisation?: "yes" | "no"; message?: string }) => void;
  setQty: (slug: string, qty: number, line?: { personalisation?: "yes" | "no"; message?: string }) => void;
  clear: () => void;
  count: number;
  items: CartItem[];
  subtotal: number;
};

function productFromLine(line: CartLine): Product | undefined {
  const found = products.find((p) => p.slug === line.slug);
  if (found) return found;
  if (!line.name || line.price == null) return undefined;
  return {
    slug: line.slug,
    name: line.name,
    sku: line.slug,
    price: line.price,
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines((JSON.parse(raw) as CartLine[]).map(normalize));
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

  const value = useMemo<CartContextValue>(() => {
    const items: CartItem[] = [];
    for (const l of lines) {
      const product = productFromLine(l);
      if (!product) continue;
      items.push({
        product,
        qty: l.qty,
        b2b: Boolean(l.b2b),
        personalisation: l.personalisation,
        message: l.message,
        unitPrice: unitPrice(product, l),
      });
    }
    return {
      lines,
      add: (slug, qty = 1, opts) =>
        setLines((prev) => {
          const b2b = Boolean(opts?.b2b);
          const personalisation = opts?.personalisation === "yes" || opts?.personalisation === "no" ? opts.personalisation : undefined;
          const message = personalisation === "yes" ? opts?.message?.trim().slice(0, 300) : undefined;
          const found = prev.find(
            (l) => l.slug === slug && l.personalisation === personalisation && (l.message ?? "") === (message ?? "")
          );
          if (found) {
            return prev.map((l) =>
              l === found ? normalize({ ...l, b2b: l.b2b || b2b, qty: l.qty + qty }) : l
            );
          }
          return [
            ...prev,
            normalize({
              slug,
              qty,
              b2b,
              personalisation,
              message,
              personalisationPrice: opts?.personalisationPrice,
              name: opts?.name,
              price: opts?.price,
              image: opts?.image,
            }),
          ];
        }),
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
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
