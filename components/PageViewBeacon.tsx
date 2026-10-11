"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Records storefront page views for the admin visitors tab. */
export function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef("");

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    if (pathname.startsWith("/admin")) return;
    last.current = pathname;
    void fetch("/api/page-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    });
  }, [pathname]);

  return null;
}
