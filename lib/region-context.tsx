"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isPriceRegion, REGION_COOKIE, regionFromCountry, regionalPrice, type PriceRegion } from "./region";

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
    if (saved) setRegion(saved);
    let cancelled = false;

    function remember(next: PriceRegion) {
      if (cancelled) return;
      setRegion(next);
      document.cookie = `${REGION_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
    }

    void (async () => {
      try {
        const res = await fetch("/api/geo");
        const data = res.ok ? await res.json() : null;
        if (data?.country && isPriceRegion(data.region)) {
          remember(data.region);
          return;
        }
      } catch {
        /* try the browser lookup */
      }
      if (saved || cancelled) return;
      try {
        const res = await fetch("https://api.country.is/", { signal: AbortSignal.timeout(4000) });
        const data = res.ok ? await res.json() : null;
        const code = typeof data?.country === "string" ? data.country : "";
        if (/^[A-Za-z]{2}$/.test(code)) remember(regionFromCountry(code));
      } catch {
        /* keep the default price */
      }
    })();

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
