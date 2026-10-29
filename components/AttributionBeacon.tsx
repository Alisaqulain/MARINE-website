"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function sessionId() {
  const key = "marina-attr-session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `attr_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  sessionStorage.setItem(key, created);
  return created;
}

export function AttributionBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = sessionId();
    void fetch("/api/ai/attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: id,
        path: pathname,
        referrer: document.referrer,
        utmSource: params.get("utm_source") || "",
        utmMedium: params.get("utm_medium") || "",
        utmCampaign: params.get("utm_campaign") || "",
      }),
    }).catch(() => undefined);
  }, [pathname]);
  return null;
}
