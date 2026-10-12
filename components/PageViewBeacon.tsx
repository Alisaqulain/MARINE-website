"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const VISITOR_KEY = "marina-visitor-id";

function visitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch {
    return "";
  }
}

/** Records a storefront visit so admin can count website visitors. */
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
      body: JSON.stringify({ path: pathname, visitorId: visitorId() }),
      keepalive: true,
    });
  }, [pathname]);

  return null;
}
