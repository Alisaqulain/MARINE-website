"use client";

import { countryName } from "@/lib/countries";

type Row = { country: string; visitors: number; views: number };

/** "IN" → 🇮🇳. Unknown or invalid codes get a globe. */
export function flagEmoji(code: string) {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌐";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Website visitors by country (from the visitor's IP), with a share bar per country. */
export function VisitorCountries({ rows, limit, onMore }: { rows: Row[]; limit?: number; onMore?: () => void }) {
  const total = rows.reduce((n, r) => n + r.visitors, 0);
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-serif text-lg text-navy-900">Visitors by country</h3>
        {onMore && rows.length ? (
          <button type="button" onClick={onMore} className="text-xs font-semibold text-[#8C6E28] underline">
            View all visitors
          </button>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-navy-600">No visitor locations recorded yet. New visits are located automatically.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const pct = total ? Math.round((r.visitors / total) * 100) : 0;
            return (
              <li key={r.country || "unknown"} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-navy-900">
                    {r.country ? `${flagEmoji(r.country)} ${countryName(r.country)}` : "🌐 Unknown (older visits)"}
                  </span>
                  <span className="shrink-0 text-xs text-navy-600">
                    <b className="text-navy-900">{r.visitors}</b> visitors · {r.views} views · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#efebe4]">
                  <div className="h-full rounded-full bg-[#031D38]" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
