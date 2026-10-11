"use client";

import { LANGUAGE_STORAGE_KEY } from "@/lib/languages";
import {
  type AppLocale,
  normalizeLocale,
  translate,
} from "@/lib/i18n/messages";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (code: string) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved) setLocaleState(normalizeLocale(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((code: string) => {
    const next = normalizeLocale(code);
    setLocaleState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  useEffect(() => {
    const onExternal = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code) setLocaleState(normalizeLocale(code));
    };
    window.addEventListener("marina-locale-change", onExternal);
    return () => window.removeEventListener("marina-locale-change", onExternal);
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, dir }), [locale, setLocale, t, dir]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useT() {
  return useLocale().t;
}
