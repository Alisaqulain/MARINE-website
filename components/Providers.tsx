"use client";

import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { SessionProvider } from "next-auth/react";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { WholesaleGateProvider } from "@/components/WholesaleGateProvider";
import { RegionProvider } from "@/lib/region-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus>
      <WholesaleGateProvider>
        <LocaleProvider>
          <RegionProvider>
          <CartProvider>
            <WishlistProvider>{children}</WishlistProvider>
          </CartProvider>
          </RegionProvider>
        </LocaleProvider>
      </WholesaleGateProvider>
    </SessionProvider>
  );
}
