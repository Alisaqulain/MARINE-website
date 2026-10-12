"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X, Heart, LayoutDashboard } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { BrandLogo } from "./Logo";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import { useT } from "@/lib/i18n/LocaleProvider";
import { HeaderAuth } from "@/components/HeaderAuth";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";

const navKeys = [
  { href: "/", key: "nav.home" },
  { href: "/shop", key: "nav.shop" },
  { href: "/wholesale", key: "nav.wholesale" },
  { href: "/custom-manufacturing", key: "nav.custom" },
  { href: "/shipping", key: "nav.shipping" },
  { href: "/blog", key: "nav.blog" },
  { href: "/about", key: "nav.about" },
  { href: "/contact", key: "nav.contact" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const [open, setOpen] = useState(false);
  const t = useT();
  const { data: session } = useSession();
  const hideAdminLink = session?.user?.role === "admin";
  const nav = navKeys.map((item) => ({
    href: item.href,
    label: t(item.key),
    wholesale: item.href === "/wholesale",
  }));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="relative bg-[#031D38]">
      <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-3 py-1 sm:px-5 xl:px-6">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <BrandLogo size="header" priority />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-x-1 lg:flex xl:gap-x-3 2xl:gap-x-4">
          {nav.map((item) => {
            const cls = `whitespace-nowrap py-2 text-[9px] font-medium uppercase tracking-[0.06em] transition-colors lg:max-xl:text-[8px] xl:text-[10px] 2xl:text-[11px] ${
              isActive(pathname, item.href) ? "text-[#C9A84C]" : "text-white/80 hover:text-[#C9A84C]"
            }`;
            if (item.wholesale) {
              return (
                <WholesaleNavLink key={item.href} callbackUrl="/wholesale" className={cls}>
                  {item.label}
                </WholesaleNavLink>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={cls}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 text-white lg:ml-0">
          <div className="hidden sm:block">
            <HeaderAuth />
          </div>
          {!hideAdminLink ? (
            <Link
              href="/admin/login"
              aria-label={t("nav.admin")}
              title={t("nav.admin")}
              className="hidden p-2 text-white/85 hover:text-[#C9A84C] sm:inline-flex"
            >
              <LayoutDashboard className="h-[18px] w-[18px]" />
            </Link>
          ) : null}
          <Link href="/wishlist" aria-label="My Wishlist" className="relative p-2 text-white/85 hover:text-[#C9A84C]">
            <Heart className="h-[18px] w-[18px]" />
            {wishCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C9A84C] px-1 text-[10px] font-semibold text-navy-950">
                {wishCount}
              </span>
            )}
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative p-2 text-white/85 hover:text-[#C9A84C]">
            <ShoppingBag className="h-[18px] w-[18px]" />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C9A84C] px-1 text-[10px] font-semibold text-navy-950">
                {count}
              </span>
            )}
          </Link>
          <button className="p-2 lg:hidden" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 max-h-[min(70vh,calc(100dvh-var(--site-nav)))] overflow-y-auto border-t border-[#C9A84C]/20 bg-[#031D38] px-5 py-3 shadow-lg lg:hidden">
          {nav.map((item) => {
            const cls = `block py-2.5 text-xs uppercase tracking-[0.16em] ${
              isActive(pathname, item.href) ? "text-[#C9A84C]" : "text-white"
            }`;
            const close = () => setOpen(false);
            if (item.wholesale) {
              return (
                <WholesaleNavLink key={item.href} callbackUrl="/wholesale" onClick={close} className={cls}>
                  {item.label}
                </WholesaleNavLink>
              );
            }
            return (
              <Link key={item.href} href={item.href} onClick={close} className={cls}>
                {item.label}
              </Link>
            );
          })}
          <div className="border-t border-[#C9A84C]/20 py-2 lg:hidden">
            <HeaderAuth />
          </div>
          {!hideAdminLink ? (
            <Link
              href="/admin/login"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 py-2.5 text-xs uppercase tracking-[0.16em] text-white lg:hidden"
            >
              <LayoutDashboard className="h-4 w-4 text-[#C9A84C]" />
              {t("nav.admin")}
            </Link>
          ) : null}
        </div>
      )}
    </header>
  );
}
