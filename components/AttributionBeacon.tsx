"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { aiSessionId } from "@/lib/ai/session-client";

export function AttributionBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = aiSessionId();
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
