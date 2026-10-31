"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "marina-cookie-choice";

export function CookieNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function choose(value: "accepted" | "rejected") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("marina-cookie-choice"));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-[#e6dfd2] bg-white p-4 shadow-xl sm:flex-row sm:items-end sm:p-5">
        <div className="min-w-0">
          <p className="font-serif text-lg text-navy-900">Privacy & cookies</p>
          <p className="mt-1 text-sm leading-relaxed text-navy-600">
            We use cookies to keep you signed in, remember your cart, and understand how the site is used. Read the{" "}
            <Link href="/privacy" className="text-[#8C6E28] underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-full bg-[#031D38] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3358]"
            onClick={() => choose("rejected")}
          >
            Reject
          </button>
          <button type="button" className="btn-gold px-4 py-2 text-sm" onClick={() => choose("accepted")}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
