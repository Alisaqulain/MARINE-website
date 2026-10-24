"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isPriceRegion, REGION_COOKIE, regionalPrice, type PriceRegion } from "./region";

type RegionContextValue = {
  region: PriceRegion;
  /** Price for the visitor's location, in US dollars. */
  priceFor: (product: { price: number; priceIndia?: number; priceUs?: number }) => number;
};

const RegionContext = createContext<RegionContextValue>({
  region: "other",
  priceFor: (product) => product.price,
});

function readCookie(): PriceRegion | null {
  try {
    const match = new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=([^;]+)`).exec(document.cookie);
    const value = match ? decodeURIComponent(match[1]) : null;
    return isPriceRegion(value) ? value : null;
  } catch {
    return null;
  }
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useState<PriceRegion>("other");

  useEffect(() => {
    const saved = readCookie();
    if (saved) {
      setRegion(saved);
      return;
    }
    let cancelled = false;
    void fetch("/api/geo")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && isPriceRegion(data?.region)) setRegion(data.region);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RegionContext.Provider value={{ region, priceFor: (product) => regionalPrice(product, region) }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
