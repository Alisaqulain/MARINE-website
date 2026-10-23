"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

function useCopied() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    flash: () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    },
  };
}

/** Share + copy link buttons for the product page. */
export function ProductShareButtons({ path, title }: { path: string; title: string }) {
  const { copied, flash } = useCopied();

  async function share() {
    const url = absoluteUrl(path);
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (await copyText(url)) flash();
  }

  async function copy() {
    if (await copyText(absoluteUrl(path))) flash();
  }

  const cls =
    "inline-flex items-center gap-1.5 rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-[12px] font-medium text-navy-800 transition hover:border-[#C9A84C]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className={cls}>
        <Share2 className="h-3.5 w-3.5 text-[#8C6E28]" />
        Share
      </button>
      <button type="button" onClick={copy} className={cls}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Link2 className="h-3.5 w-3.5 text-[#8C6E28]" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}

/** Compact share icon for product cards: native share sheet, falling back to copying the link. */
export function ProductShareIcon({ path, title, className = "" }: { path: string; title: string; className?: string }) {
  const { copied, flash } = useCopied();

  async function share(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = absoluteUrl(path);
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (await copyText(url)) flash();
  }

  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : "Share or copy link"}
      title={copied ? "Link copied" : "Share or copy link"}
      onClick={share}
      className={`grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#222222] shadow-sm ${className}`}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Share2 className="h-4 w-4" />}
    </button>
  );
}
