export function ImageOverlayText({
  text,
  x,
  y,
  className,
}: {
  text?: string;
  x?: number;
  y?: number;
  className?: string;
}) {
  const label = text?.trim();
  if (!label) return null;
  const placed = Number.isFinite(x) && Number.isFinite(y);
  return (
    <span
      className={
        placed
          ? "pointer-events-none absolute z-[2] max-w-[90%] -translate-x-1/2 -translate-y-1/2 text-center text-sm font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.65)]"
          : `pointer-events-none absolute inset-x-2 z-[2] text-center text-sm font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.65)] ${className ?? "bottom-3"}`
      }
      style={placed ? { left: `${x}%`, top: `${y}%` } : undefined}
    >
      {label}
    </span>
  );
}
