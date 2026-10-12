"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SITE_LOCALES } from "@/lib/languages";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { normalizeLocale } from "@/lib/i18n/messages";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const code = locale;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SITE_LOCALES.find((l) => l.code === code) ?? SITE_LOCALES[0];

  const select = (next: string) => {
    const code = normalizeLocale(next);
    setLocale(code);
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent("marina-locale-change", { detail: code }));
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Language: ${current.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[#d9c9a3] hover:text-[#C9A84C]"
      >
        <Globe className="h-3 w-3 text-[#C9A84C]" />
        <span className="hidden max-w-[7.5rem] truncate sm:inline">{current.name}</span>
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(14rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[#C9A84C]/25 bg-[#0B1D36] shadow-lg">
          <ul role="listbox" aria-label="Languages" className="py-1">
            {SITE_LOCALES.map((l) => {
              const active = l.code === code;
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => select(l.code)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 ${
                      active ? "text-[#C9A84C]" : "text-white/90"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.name}</span>
                      {l.code !== "en" ? (
                        <span className="block truncate text-[10px] text-white/45">{l.native}</span>
                      ) : null}
                    </span>
                    {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
