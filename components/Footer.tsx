"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Facebook,
  Instagram,
  Linkedin,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Youtube,
} from "lucide-react";
import { BrandLogo } from "./Logo";
import { company } from "@/lib/company";
import { useT } from "@/lib/i18n/LocaleProvider";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";

const socials = [
  { label: "Facebook", Icon: Facebook },
  { label: "Instagram", Icon: Instagram },
  { label: "YouTube", Icon: Youtube },
  { label: "LinkedIn", Icon: Linkedin },
];

const promises = [
  { icon: CreditCard, title: "Multiple Payment Options", body: "Cards, UPI, bank transfer & trade terms" },
  { icon: WhatsAppMark, title: "WhatsApp & Email", body: "Quotes and order updates, same day" },
  { icon: Sparkles, title: "AI Search & Recommendations", body: "Smarter nautical finds, faster results" },
  { icon: ShieldCheck, title: "Secure & Trusted", body: "SSL checkout · Export documents" },
];

const securePoints = ["Multiple Payment Options", "Export Documents", "Trade Terms"];

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.33 4.94L2 22l5.39-1.41a10.1 10.1 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2zm5.75 14.12c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.66-.61-2.92-1.26-4.82-4.2-4.97-4.4-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.26-.29.57-.36.76-.36h.55c.17 0 .41-.07.64.49.24.58.8 2 .87 2.14.07.15.12.32.02.51-.1.2-.14.32-.28.49-.14.17-.3.38-.42.51-.14.15-.29.31-.12.6.16.29.73 1.2 1.56 1.95 1.08.96 1.98 1.26 2.26 1.4.28.15.45.12.61-.07.16-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.26.1 1.64.77 1.92.91.28.15.47.22.54.34.07.12.07.7-.17 1.38z" />
    </svg>
  );
}

function PayBadge({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-label={label}
      className={`inline-flex h-7 w-full min-w-0 items-center justify-center overflow-hidden rounded-[5px] bg-white px-1 shadow-sm sm:w-auto sm:min-w-[2.5rem] sm:px-1.5 ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

function PaymentMarks() {
  return (
    <>
      <PayBadge label="Visa">
        <span className="text-[10px] font-extrabold italic tracking-tight text-[#1A1F71] sm:text-[11px]">VISA</span>
      </PayBadge>
      <PayBadge label="Mastercard">
        <span className="relative h-4 w-7 shrink-0 overflow-visible">
          <span className="absolute left-0 top-0.5 h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
          <span className="absolute left-2.5 top-0.5 h-3.5 w-3.5 rounded-full bg-[#F79E1B]/90" />
        </span>
      </PayBadge>
      <PayBadge label="American Express" className="!bg-[#2E77BB]">
        <span className="text-center text-[6.5px] font-extrabold leading-[1.05] tracking-wide text-white sm:text-[7px]">
          AMERICAN
          <br />
          EXPRESS
        </span>
      </PayBadge>
      <PayBadge label="RuPay">
        <span className="text-[9px] font-extrabold text-[#0B57A8] sm:text-[10px]">RuPay</span>
      </PayBadge>
      <PayBadge label="UPI">
        <span className="text-[10px] font-extrabold text-[#097939] sm:text-[11px]">UPI</span>
      </PayBadge>
      <PayBadge label="Bank transfer">
        <Building2 className="h-3.5 w-3.5 text-[#031D38]" />
      </PayBadge>
    </>
  );
}

export function Footer() {
  const t = useT();
  type FooterLink = { label: string; href?: string; wholesale?: string };
  const businessLinks: FooterLink[] = [
    { label: t("footer.link.wholesale"), wholesale: "/wholesale" },
    { label: t("footer.link.wholesaleAccount"), wholesale: "/wholesale" },
    { label: t("footer.link.quote"), wholesale: "/wholesale/quote" },
    { label: t("footer.link.custom"), href: "/custom-manufacturing" },
  ];

  const columns = [
    {
      title: t("footer.shop"),
      links: [
        [t("footer.link.retail"), "/shop"],
        [t("footer.link.collections"), "/collections"],
        [t("footer.link.wishlist"), "/wishlist"],
        [t("footer.link.cart"), "/cart"],
      ],
    },
    {
      title: t("footer.business"),
      links: businessLinks,
    },
    {
      title: t("footer.company"),
      links: [
        [t("footer.link.about"), "/about"],
        [t("footer.link.contact"), "/contact"],
        [t("footer.link.blog"), "/blog"],
        [t("footer.link.shipping"), "/shipping"],
      ],
    },
  ];

  return (
    <footer className="mt-auto overflow-x-hidden bg-[#031D38] text-cream-100">
      <div className="border-y border-white/10 bg-[#0D3159]">
        <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-x-3 gap-y-3 px-4 py-3 md:grid-cols-4 md:gap-5 md:px-5 md:py-5">
          {promises.map((p) => {
            const inner = (
              <>
                <p.icon className="h-4 w-4 shrink-0 text-[#C9A84C] md:h-5 md:w-5" />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[9px] font-medium leading-none tracking-tight md:text-[13px] md:tracking-normal">
                    {p.title}
                  </p>
                  <p className="mt-0.5 truncate text-[8px] leading-snug text-cream-100/60 md:mt-1 md:text-xs">
                    {p.body}
                  </p>
                </div>
              </>
            );
            const toPayment = p.title === "Multiple Payment Options" || p.title === "Secure & Trusted";
            return toPayment ? (
              <Link key={p.title} href="/payment" className="flex min-w-0 items-center gap-2 transition hover:text-[#E8D5A3] md:gap-3">
                {inner}
              </Link>
            ) : (
              <div key={p.title} className="flex min-w-0 items-center gap-2 md:gap-3">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      <Link
        href="/payment"
        className="block border-b border-white/10 bg-[#082445] transition hover:bg-[#0a2c52]"
        aria-label="Secure International Payment"
      >
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-2.5 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#C9A84C]/70 text-[#C9A84C] sm:h-9 sm:w-9">
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A84C] sm:text-[11px]">
                  Secure Payment
                </p>
                <p className="text-[10px] text-cream-100/70 sm:text-[11px]">SSL Secure Checkout</p>
              </div>
            </div>
            <div className="flex flex-nowrap items-center justify-between gap-1 sm:justify-start sm:gap-x-5">
              {securePoints.map((item) => (
                <p
                  key={item}
                  className="flex min-w-0 items-center gap-0.5 whitespace-nowrap text-[8px] leading-none text-cream-100/85 sm:gap-1.5 sm:text-[12px]"
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-[#C9A84C] sm:h-4 sm:w-4" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-6 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-start lg:justify-end">
            <PaymentMarks />
          </div>
        </div>
      </Link>

      <div className="mx-auto max-w-[1320px] px-4 py-4 sm:px-5 sm:py-6 md:py-8">
        <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:gap-x-6 sm:gap-y-6 lg:grid-cols-4 lg:gap-8">
          <div className="col-span-3 lg:col-span-1">
            <BrandLogo size="footer" />
            <p className="mt-1.5 max-w-sm text-[11px] leading-snug text-cream-100/70 sm:mt-3 sm:text-sm sm:leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className={col.title === "Company" ? "max-sm:pl-11 max-sm:translate-x-1" : undefined}>
              <p className="text-[9px] uppercase tracking-[0.16em] text-[#C9A84C] sm:text-[11px] sm:tracking-[0.24em]">{col.title}</p>
              <ul className="mt-1.5 space-y-1 sm:mt-3 sm:space-y-2">
                {col.links.map((link) => {
                  const label = Array.isArray(link) ? link[0] : link.label;
                  const href = Array.isArray(link) ? link[1] : link.href;
                  const wholesale = Array.isArray(link) ? undefined : link.wholesale;
                  const key = `${col.title}-${label}`;
                  const cls =
                    "whitespace-nowrap text-[9px] tracking-tight text-cream-100/75 transition hover:text-[#C9A84C] sm:text-sm sm:tracking-normal";
                  if (wholesale) {
                    return (
                      <li key={key}>
                        <WholesaleNavLink callbackUrl={wholesale} className={cls}>
                          {label}
                        </WholesaleNavLink>
                      </li>
                    );
                  }
                  return (
                    <li key={key}>
                      <Link href={href ?? "/"} className={cls}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 py-2.5 sm:px-5 sm:py-4 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
          <div className="flex min-w-0 gap-2 sm:gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C] sm:h-5 sm:w-5" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.16em] text-[#C9A84C] sm:text-[11px] sm:tracking-[0.2em]">{t("footer.office")}</p>
              <p className="mt-0.5 max-w-xl text-[11px] leading-snug text-cream-100/65 sm:text-sm sm:leading-relaxed">
                {company.address[0]}, {company.address[1]}, {company.address[2]}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 gap-2 sm:gap-3 lg:max-w-md">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C] sm:h-5 sm:w-5" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.16em] text-[#C9A84C] sm:text-[11px] sm:tracking-[0.2em]">{t("footer.contact")}</p>
              <a href={`tel:${company.phoneTel}`} className="mt-1 block text-[11px] text-cream-100/75 hover:text-[#C9A84C] sm:text-sm">
                {company.phone}
              </a>
              <a
                href={`mailto:${company.email}`}
                className="mt-0.5 block break-all text-[11px] text-cream-100/75 hover:text-[#C9A84C] sm:text-sm"
              >
                {company.email}
              </a>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5 sm:gap-2.5">
            {socials.map(({ label, Icon }) => (
              <span
                key={label}
                aria-label={label}
                aria-disabled="true"
                title={label}
                className="inline-flex h-7 w-7 cursor-default items-center justify-center rounded-full bg-[#C9A84C] text-[#031D38] sm:h-10 sm:w-10"
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1320px] px-4 py-2 pb-14 text-center text-[11px] leading-snug text-cream-100/45 sm:px-5 sm:py-3 sm:pb-3 sm:text-xs">
          © 2026 {company.name}. Exporter · Manufacturer · Supplier.
          <span className="mt-1 block text-cream-100/55 sm:mt-0 sm:inline">
            {" "}
            | Developed by{" "}
            <a
              href="https://robustwebsolution.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#C9A84C] underline-offset-2 hover:underline"
            >
              Robust Web Solution
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
