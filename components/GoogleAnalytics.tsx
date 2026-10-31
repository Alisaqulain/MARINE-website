"use client";

import { useEffect } from "react";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || "";
const CHOICE_KEY = "marina-cookie-choice";

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

function load() {
  const w = window as GtagWindow;
  if (!MEASUREMENT_ID || w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
  w.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

/** GA4 page tracking, loaded only after the visitor accepts cookies. Purchases are also sent server-side. */
export function GoogleAnalytics() {
  useEffect(() => {
    if (!MEASUREMENT_ID) return;
    const check = () => {
      try {
        if (localStorage.getItem(CHOICE_KEY) === "accepted") load();
      } catch {
        /* storage blocked: no analytics */
      }
    };
    check();
    window.addEventListener("marina-cookie-choice", check);
    return () => window.removeEventListener("marina-cookie-choice", check);
  }, []);
  return null;
}
