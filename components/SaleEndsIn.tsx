"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "0:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "3 days" while more than 24 hours are left (rounded up, so 2 days 5 hours shows "3 days"). */
function formatDays(ms: number) {
  const days = Math.ceil(ms / DAY_MS);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Countdown under sale prices for the whole sale: "Sale ends in 3 days" while more than 24 hours are left,
 * then a live hours:minutes:seconds timer ("Sale ends in 9:14:32") in the last 24 hours.
 */
export function SaleEndsIn({
  endsAt,
  percent,
  name,
  className = "",
}: {
  endsAt?: string;
  percent?: number;
  /** The sale's name from admin "Run a sale", e.g. "DiwaliSale". */
  name?: string;
  className?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!endsAt || !percent) {
      setLabel(null);
      return;
    }
    const end = Date.parse(endsAt);
    if (!Number.isFinite(end)) {
      setLabel(null);
      return;
    }
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) {
        setLabel(null);
        return;
      }
      setLabel(`${name ? `${name} · ` : ""}${percent}% off · Sale ends in ${left > DAY_MS ? formatDays(left) : formatRemaining(left)}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, percent, name]);

  if (!label) return null;
  return <p className={`text-[11px] font-semibold text-red-700 sm:text-[12px] ${className}`}>{label}</p>;
}
