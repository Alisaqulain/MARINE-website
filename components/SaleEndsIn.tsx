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

const SHOW_WITHIN_MS = 24 * 60 * 60 * 1000;

/** Live countdown under sale prices (Sale ends in 9:14:32), shown only in the sale's last 24 hours. */
export function SaleEndsIn({
  endsAt,
  percent,
  className = "",
}: {
  endsAt?: string;
  percent?: number;
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
      if (left <= 0 || left > SHOW_WITHIN_MS) {
        setLabel(null);
        return;
      }
      setLabel(`${percent}% off · Sale ends in ${formatRemaining(left)}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, percent]);

  if (!label) return null;
  return <p className={`text-[11px] font-semibold text-red-700 sm:text-[12px] ${className}`}>{label}</p>;
}
