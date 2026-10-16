"use client";

import Link from "next/link";
import Image from "next/image";
import { Briefcase, ChevronLeft, ChevronRight, Play, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { useRef, useState } from "react";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";

const btnBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-center font-semibold uppercase transition duration-300";

const btnPad =
  "box-border h-8 w-[10rem] px-2.5 text-[7.5px] tracking-[0.05em] sm:h-9 sm:w-[11.25rem] sm:text-[8px] md:h-9 md:w-[12.25rem] md:px-3 md:text-[9px] md:tracking-[0.08em] lg:h-10 lg:w-[13.5rem] lg:px-4 lg:text-[10px]";

const heroBtnPad =
  "box-border h-10 w-[12.75rem] px-3 text-[9px] tracking-[0.06em] sm:h-11 sm:w-[14.75rem] sm:text-[11px] md:h-12 md:w-[16.25rem] md:px-4 md:text-[12px] md:tracking-[0.08em] lg:h-[3.25rem] lg:w-[18rem] lg:text-[13px]";

const arrowCls =
  "absolute top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-[#081525]/50 text-white shadow-[0_4px_16px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-[#081525]/80 sm:h-10 sm:w-10 lg:h-11 lg:w-11";

const slides = [
  {
    src: "/firstbannerlaptop.jpeg",
    mobileSrc: "/firstbannermobile.jpeg",
    alt: "Real viewing, not just décor. Worldwide shipping, premium brass craftsmanship, ideal for gifts and home décor",
    at: { left: "45%", top: "56%", center: true },
    buttons: true,
    pos: "sm:object-center",
    accent: "#C9A84C",
    primaryCls:
      "bg-[#F3E6C8] text-[#0B1D36] hover:bg-[#fff6e4]",
    secondaryCls:
      "bg-[#C9A84C] text-[#0B1D36] hover:bg-[#d4b45a]",
  },
  {
    src: "/Banners/2.png",
    mobileSrc: "/mobile/decor.png",
    alt: "Brass Decor and Lighting Collection — chandeliers, wall sconces, lamps and jewellery",
    at: { left: "50%", top: "46%", center: true },
    pos: "sm:object-center",
    accent: "#D4AF37",
    primaryCls:
      "bg-[#E8D5A3] text-[#1a1408] hover:bg-[#fff1d0]",
    secondaryCls:
      "border border-[#C9A84C] bg-[#081525]/40 text-[#F3E6C8] backdrop-blur-sm hover:bg-[#C9A84C]/20",
  },
  {
    src: "/Banners/3.png",
    mobileSrc: "/mobile/kitchen.png",
    alt: "Premium Brass Kitchenware — handcrafted cookware, drinkware and serveware",
    at: { left: "42%", top: "44%", center: true },
    pos: "sm:object-center",
    accent: "#C9A227",
    primaryCls:
      "bg-[#E8C97A] text-[#1a1408] hover:bg-[#f3d78a]",
    secondaryCls:
      "border border-[#C9A84C] bg-[#081525]/40 text-[#F3E6C8] backdrop-blur-sm hover:bg-[#C9A84C]/20",
  },
  {
    src: "/hero-4.jpeg",
    mobileSrc: "/mobile/business.png",
    alt: "Built for Business. Shipped Worldwide. Brass globe, telescope and lanterns with a cargo ship behind",
    at: { left: "4.8%", top: "56%" },
    buttons: true,
    mobileDock: true,
    pos: "sm:object-center",
    accent: "#E0B455",
    primaryCls:
      "bg-[#F3E6C8] text-[#0B1D36] hover:bg-[#fff6e4]",
    secondaryCls:
      "bg-[#C9A84C] text-[#0B1D36] hover:bg-[#d4b45a]",
  },
];

export function HomeHero() {
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const slide = slides[i];

  function prev() {
    setI((n) => (n === 0 ? slides.length - 1 : n - 1));
  }

  function next() {
    setI((n) => (n === slides.length - 1 ? 0 : n + 1));
  }

  return (
    <section className="relative isolate bg-[#081525] text-white">
      <h1 className="sr-only">
        Marina Muse International — handcrafted brass, nautical and armour products
      </h1>

      {/* ================= MOBILE + DESKTOP BANNER ================= */}
      <div
        className="relative mx-auto w-full max-w-[1920px] max-sm:overflow-visible sm:aspect-[1600/633] sm:overflow-hidden"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;

          const dx =
            e.changedTouches[0].clientX - touchX.current;

          if (dx > 40) prev();
          if (dx < -40) next();

          touchX.current = null;
        }}
      >
        {/* SLIDES */}
        <Image
          src={slides[0].mobileSrc}
          alt=""
          width={1374}
          height={1145}
          aria-hidden
          quality={95}
          sizes="100vw"
          className="pointer-events-none block h-auto w-full max-w-full object-contain sm:hidden"
        />
        {slides.map((s, idx) => (
          <Image
            key={`${s.src}-m`}
            src={s.mobileSrc}
            alt={s.alt}
            fill
            priority={idx === 0}
            quality={95}
            sizes="100vw"
            className={`object-contain object-center transition-opacity duration-700 sm:hidden ${
              idx === i ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}
        {slides.map((s, idx) => (
          <Image
            key={s.src}
            src={s.src}
            alt=""
            fill
            aria-hidden
            quality={95}
            sizes="100vw"
            className={`hidden object-cover transition-opacity duration-700 sm:block ${
              s.pos ?? "sm:object-center"
            } ${idx === i ? "opacity-100" : "pointer-events-none opacity-0"}`}
          />
        ))}

        {/* BUTTONS */}
        {slide.buttons && (
          <div
            key={slide.src}
            className={`absolute z-20 animate-fadeIn flex-col gap-1.5 sm:gap-2 md:gap-3 ${
              slide.mobileDock
                ? "hidden sm:flex sm:bottom-auto sm:left-[4.8%] sm:top-[48%] sm:w-auto sm:translate-x-0 sm:items-stretch sm:pt-4 md:pt-6 lg:pt-8"
                : "left-1/2 top-[28%] flex -translate-x-1/2 items-center sm:top-[36%] md:top-[32%]"
            }`}
          >
            <div
              className={`${i === 0 ? "hidden sm:flex" : "flex"} ${
                slide.at.center || slide.mobileDock
                  ? "flex-row flex-nowrap items-center justify-center gap-2 sm:gap-2 md:gap-3"
                  : "flex-row flex-nowrap items-center justify-center gap-1.5 sm:flex-col sm:gap-2 md:gap-3"
              } ${slide.mobileDock ? "sm:flex-col sm:items-stretch sm:justify-start" : ""}`}
            >
              <Link
                href="/shop"
                className={`${btnBase} ${i === 0 ? heroBtnPad : btnPad} shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${slide.primaryCls}`}
              >
                B2C Retail Collection
              </Link>
              <WholesaleNavLink
                callbackUrl="/wholesale"
                className={`${btnBase} ${i === 0 ? heroBtnPad : btnPad} ${slide.secondaryCls}`}
              >
                B2B Wholesale Collection
              </WholesaleNavLink>
            </div>
            {i === 0 ? (
              <a
                href="https://www.instagram.com/reel/DecPczRB8N2/?obrf=MjJoamdzNjB5cjQz"
                target="_blank"
                rel="noopener noreferrer"
                className="group -mt-1.5 flex flex-nowrap items-center gap-2 whitespace-nowrap sm:-mt-0.5 sm:gap-3"
              >
                <span className="relative grid h-8 w-8 shrink-0 place-items-center sm:h-11 sm:w-11 lg:h-14 lg:w-14">
                  <span className="absolute inset-0 rounded-full bg-[#F6BE52]/50 animate-story-ring group-hover:[animation-play-state:paused]" />
                  <span className="absolute inset-0 rounded-full bg-[#FFD56A]/40 animate-story-ring [animation-delay:1s] group-hover:[animation-play-state:paused]" />
                  <span className="relative z-10 grid h-full w-full place-items-center rounded-full bg-[#F6BE52] text-[#0B1D36] ring-2 ring-[#FFE7A8]/90 shadow-[0_0_28px_rgba(246,190,82,0.85)] transition animate-story-pulse group-hover:bg-[#ffd56a] group-hover:[animation-play-state:paused]">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-current sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                  </span>
                </span>
                <span className="whitespace-nowrap font-serif text-[14px] font-semibold tracking-[0.02em] text-white underline decoration-[#F6BE52] decoration-2 underline-offset-[5px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition group-hover:text-[#F6BE52] sm:text-[18px] sm:tracking-[0.04em] lg:text-[22px]">
                  Watch Our Story
                </span>
              </a>
            ) : null}
          </div>
        )}

        <button
          type="button"
          aria-label="Previous slide"
          onClick={prev}
          className={`${arrowCls} hidden left-1.5 sm:left-3 sm:flex lg:left-4`}
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={next}
          className={`${arrowCls} hidden right-1.5 sm:right-3 sm:flex lg:right-4`}
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>

        {/* DOTS */}
        <div className="absolute bottom-1.5 left-1/2 z-30 flex -translate-x-1/2 gap-1.5 sm:bottom-4 sm:gap-2">
          {slides.map((s, idx) => (
            <button
              key={s.src}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all sm:h-2 ${
                idx === i
                  ? "w-5 sm:w-7"
                  : "w-1.5 bg-white/60 hover:bg-white sm:w-2"
              }`}
              style={
                idx === i
                  ? { backgroundColor: slide.accent }
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-[#031D38]/15 bg-[#C9A84C] text-[#031D38]">
        <Link
          href="/shipping"
          className="flex items-center justify-center gap-2 px-2 py-2.5 transition hover:bg-[#d4b45a] sm:gap-3 sm:px-6 sm:py-3.5"
        >
          <Truck className="h-5 w-5 shrink-0 text-[#031D38] sm:h-6 sm:w-6" strokeWidth={1.7} />
          <span className="min-w-0 text-left">
            <span className="block text-[12px] font-semibold leading-tight sm:text-[15px]">Worldwide Shipping</span>
            <span className="mt-0.5 block text-[10px] leading-tight text-[#031D38]/75 sm:text-[12px]">On all orders worldwide</span>
          </span>
        </Link>
        <Link
          href="/returns"
          className="flex items-center justify-center gap-2 px-2 py-2.5 transition hover:bg-[#d4b45a] sm:gap-3 sm:px-6 sm:py-3.5"
        >
          <RotateCcw className="h-5 w-5 shrink-0 text-[#031D38] sm:h-6 sm:w-6" strokeWidth={1.7} />
          <span className="min-w-0 text-left">
            <span className="block text-[12px] font-semibold leading-tight sm:text-[15px]">Easy Return</span>
            <span className="mt-0.5 block text-[10px] leading-tight text-[#031D38]/75 sm:text-[12px]">14-day return support</span>
          </span>
        </Link>
      </div>

      <div className="flex divide-x divide-[#C9A84C]/35 border-t border-[#C9A84C]/40 bg-[#031D38] text-[#F3E6C8] sm:hidden">
        <Link
          href="/shop"
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 transition hover:bg-[#0B1D36]"
        >
          <ShoppingBag className="h-4 w-4 shrink-0 text-[#C9A84C]" strokeWidth={1.7} />
          <span className="text-center text-[9px] font-semibold leading-tight">B2C Retail Collection</span>
        </Link>
        <WholesaleNavLink
          callbackUrl="/wholesale"
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 transition hover:bg-[#0B1D36]"
        >
          <Briefcase className="h-4 w-4 shrink-0 text-[#C9A84C]" strokeWidth={1.7} />
          <span className="text-center text-[9px] font-semibold leading-tight">B2B Wholesale Collection</span>
        </WholesaleNavLink>
      </div>
    </section>
  );
}
