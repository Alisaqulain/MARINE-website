"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { useSession } from "next-auth/react";
import { useT } from "@/lib/i18n/LocaleProvider";
import { canAccessWholesale, isRetailCustomer } from "@/lib/wholesale-access";
import { useWholesaleGate } from "@/components/WholesaleGateProvider";

export function HomeWholesaleCta() {
  const { data: session, status } = useSession();
  const loggedIn = status === "authenticated" && Boolean(session?.user);
  const wholesaleUser = canAccessWholesale(session?.user);
  const retailUser = isRetailCustomer(session?.user);
  const { promptSwitchToWholesale } = useWholesaleGate();
  const t = useT();

  return (
    <section className="relative overflow-hidden bg-[#081525] py-12 text-cream-50 md:py-16">
      <Image
        src="/contact-us-slide.jpeg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[68%_center] opacity-55"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#081525] via-[#081525]/78 to-[#081525]/20" />
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-8 px-5 text-center md:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)] md:gap-10 md:text-left">
        <div className="max-w-2xl md:max-w-none">
          <p className="text-[12px] font-semibold uppercase tracking-[0.32em] text-[#C9A84C] md:text-[13px]">
            {t("home.wholesale.eyebrow")}
          </p>
          <h2 className="mt-3 font-serif text-[2.1rem] leading-[1.12] md:text-[3.35rem] lg:text-[3.75rem]">
            {t("home.wholesale.title1")}
            <br />
            {t("home.wholesale.title2")}
          </h2>
          <p className="mt-5 mx-auto max-w-xl text-[16px] leading-relaxed text-cream-100/85 md:mx-0 md:text-[18px]">
            {t("home.wholesale.body")}
          </p>
          <p className="mt-5 flex items-center justify-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[#C9A84C] sm:tracking-[0.2em] md:justify-start md:text-[13px]">
            <MapPin className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
            {t("home.wholesale.location")}
          </p>
        </div>
        {!loggedIn ? (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-[#C9A84C]/30 bg-[#081525]/72 p-5 shadow-[0_24px_50px_rgba(0,0,0,0.4)] backdrop-blur-md md:mx-0 md:ml-auto md:p-7">
            <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C9A84C] md:text-[12px]">
              {t("home.wholesale.openAccount")}
            </p>
            <div className="flex flex-col gap-3.5">
              <Link href="/login?mode=wholesale&view=register&callbackUrl=/wholesale" className="btn-gold w-full">
                {t("home.wholesale.createAccount")}
              </Link>
              <Link href="/login?mode=wholesale&callbackUrl=/wholesale" className="btn-outline w-full">
                {t("home.wholesale.alreadyMember")}
              </Link>
              <Link href="/about" className="btn-outline w-full">
                {t("home.wholesale.ourStory")}
              </Link>
            </div>
          </div>
        ) : wholesaleUser ? (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-[#C9A84C]/30 bg-[#081525]/72 p-5 md:mx-0 md:ml-auto md:p-7">
            <p className="text-center text-sm text-cream-100/90">
              {t("home.wholesale.welcomeBack")}, {session?.user?.name?.split(" ")[0] ?? "partner"}.
            </p>
            <Link href="/wholesale" className="btn-gold mt-4 w-full">
              {t("home.wholesale.goCatalogue")}
            </Link>
          </div>
        ) : retailUser ? (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-[#C9A84C]/30 bg-[#081525]/72 p-5 md:mx-0 md:ml-auto md:p-7">
            <p className="text-center text-sm text-cream-100/90">
              Welcome back, {session?.user?.name?.split(" ")[0] ?? "there"}. You are on a retail account.
            </p>
            <button
              type="button"
              className="btn-gold mt-4 w-full"
              onClick={() => promptSwitchToWholesale("/wholesale")}
            >
              Open wholesale (B2B) account
            </button>
            <Link href="/retail" className="btn-outline mt-3 w-full">
              Continue retail shopping
            </Link>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-[#C9A84C]/30 bg-[#081525]/72 p-5 md:mx-0 md:ml-auto md:p-7">
            <p className="text-center text-sm text-cream-100/90">
              Welcome back, {session?.user?.name?.split(" ")[0] ?? "there"}.
            </p>
            <Link href="/retail" className="btn-gold mt-4 w-full">
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
