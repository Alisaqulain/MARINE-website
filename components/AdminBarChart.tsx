"use client";

import { useState } from "react";

export type DayPoint = { day: string; value: number; detail?: string };

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 36 };
const BAR = "#031D38";

/** Daily bar chart (one series). Hover or focus a day for its value and detail. */
export function AdminBarChart({ data, unit = "views" }: { data: DayPoint[]; unit?: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (!data.length) return null;

  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.max(1, Math.ceil(max / 3));
  const top = step * 3;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(2, slot - 2);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const label = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const every = Math.ceil(data.length / 8);
  const point = active !== null ? data[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${unit} per day`}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(step * i)} y2={y(step * i)} stroke="#e6dfd2" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(step * i) + 4} textAnchor="end" fontSize="11" fill="#5b6b80">
              {step * i}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + 1;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.day}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + barW - r} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + r} V${y(0)} Z`}
                  fill={BAR}
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                aria-label={`${label(d.day)}: ${d.value} ${unit}`}
              />
              {i % every === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#5b6b80">
                  {label(d.day)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#b9ae99" strokeWidth={1} />
      </svg>
      {point && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-[#e6dfd2]"
          style={{ left: `${((PAD.left + (active + 0.5) * slot) / W) * 100}%` }}
        >
          <p className="font-semibold text-[#031D38]">{label(point.day)}</p>
          <p className="text-[#3d4f66]">
            <b className="text-[#031D38]">{point.value}</b> {unit}
            {point.detail ? ` · ${point.detail}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
