"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { BannerHero } from "@/components/BannerHero";
import { canAccessWholesale } from "@/lib/wholesale-access";

export function WholesalePageBanner() {
  const { data: session } = useSession();
  const wholesaleOk = canAccessWholesale(session?.user);

  return (
    <div className="relative">
      <BannerHero
        src="/b2blaptop.jpeg"
        mobileSrc="/b2bmobile1.jpeg"
        alt="B2B / Wholesale — Built for Businesses. Priced for Volume."
        title="B2B Wholesale — Built for Businesses. Priced for Volume."
      />
      {!wholesaleOk ? (
        <div className="pointer-events-none absolute inset-0 mx-auto w-full max-w-[1920px]">
          <div className="pointer-events-auto absolute left-[8%] top-[46%] flex flex-col items-start gap-2 sm:left-[7%] sm:top-[62%] sm:gap-3">
            <Link
              href="/login?mode=wholesale&view=register&callbackUrl=/wholesale"
              className="inline-flex h-8 items-center justify-center rounded-full bg-[#C9A84C] px-3 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#0B1D36] shadow-[0_4px_12px_rgba(0,0,0,0.28)] transition hover:bg-[#d4b45a] sm:h-10 sm:px-5 sm:text-[11px] sm:tracking-[0.12em]"
            >
              Create Wholesale Account
            </Link>
            <Link
              href="/login?mode=wholesale&callbackUrl=/wholesale"
              className="text-[11px] font-semibold text-white underline decoration-white/70 underline-offset-2 sm:text-sm"
            >
              Login
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
