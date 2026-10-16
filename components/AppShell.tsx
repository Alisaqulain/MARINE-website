"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { PageViewBeacon } from "./PageViewBeacon";
import { ChatWidget } from "./ChatWidget";
import { CookieNotice } from "./CookieNotice";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--site-nav", `${Math.round(el.getBoundingClientRect().height)}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--site-nav");
    };
  }, [isAdmin]);

  if (isAdmin) {
    return <div className="min-h-screen bg-[#F4F1EA]">{children}</div>;
  }

  return (
    <>
      <div ref={navRef} className="sticky top-0 z-50">
        <TopBar />
        <Header />
      </div>
      <PageViewBeacon />
      <main className="flex-1">{children}</main>
      <Footer />
      <CookieNotice />
      <ChatWidget />
    </>
  );
}
