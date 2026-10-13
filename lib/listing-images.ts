export type ListingImage = {
  url: string;
  name: string;
  color: string;
  text: string;
  /** Horizontal placement of the text, 0–100. */
  textX?: number;
  /** Vertical placement of the text, 0–100. */
  textY?: number;
};

function textPercent(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function colorsFromImages(images?: ListingImage[], extra?: string[]) {
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const color of [...(images ?? []).map((image) => image.color), ...(extra ?? [])]) {
    const label = color.trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    colors.push(label);
  }
  return colors;
}

/** Index of the photo tagged with this color, or -1. */
export function imageIndexForColor(images: ListingImage[] | undefined, color: string) {
  if (!images?.length || !color.trim()) return -1;
  const key = color.trim().toLowerCase();
  return images.findIndex((image) => image.color.trim().toLowerCase() === key);
}

export function parseListingImages(value: unknown): ListingImage[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const url = String(row.url ?? "").trim();
    if (!url) return [];
    return [
      {
        url,
        name: String(row.name ?? "").trim(),
        color: String(row.color ?? "").trim(),
        text: String(row.text ?? "").trim(),
        textX: textPercent(row.textX),
        textY: textPercent(row.textY),
      },
    ];
  });
}
