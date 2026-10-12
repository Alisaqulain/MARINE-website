"use client";

import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { TopBarSearch } from "./TopBarSearch";
import { useT } from "@/lib/i18n/LocaleProvider";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";

export function TopBar() {
  const t = useT();

  return (
    <div className="relative z-50 bg-[#081525] text-[11px] text-[#d9c9a3]">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-2 px-3 py-3 text-[13px] sm:gap-4 sm:px-5 md:py-2.5 md:text-sm">
        <div className="hidden items-center gap-4 md:flex">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[#C9A84C]" />
            {t("top.premium")}
          </span>
          <span className="text-white/20">|</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[#C9A84C]" />
            {t("top.handcrafted")}
          </span>
        </div>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate pr-2 text-[#d9c9a3] md:hidden">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#C9A84C]" />
          {t("top.handcrafted")}
        </span>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <LanguageSwitcher />
          <span className="text-white/20">|</span>
          <TopBarSearch />
          <span className="hidden text-white/20 sm:inline">|</span>
          <WholesaleNavLink
            callbackUrl="/wholesale/quote"
            className="hidden text-[#C9A84C] hover:text-[#e0c87a] sm:inline"
          >
            {t("top.wholesaleQuote")}
          </WholesaleNavLink>
        </div>
      </div>
    </div>
  );
}
