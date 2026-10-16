"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { resolveMediaUrl, isUploadedMedia } from "@/lib/media-url";

/** Product / admin thumbnail — handles /api/media, /uploads, and absolute URLs. */
export function ProductImage({
  src,
  alt = "",
  className,
  fill,
  sizes,
  width,
  height,
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
}) {
  const resolved = resolveMediaUrl(src);
  if (!resolved) {
    return (
      <div
        className={`flex items-center justify-center bg-[#f4f1ea] text-[10px] text-navy-400 ${className ?? ""}`}
        style={fill ? undefined : { width, height }}
      >
        —
      </div>
    );
  }
  const unoptimized = isUploadedMedia(src) || isUploadedMedia(resolved);
  const props = {
    src: resolved,
    alt,
    className,
    unoptimized,
    sizes,
    style,
  };
  if (fill) {
    return <Image {...props} fill />;
  }
  return <Image {...props} width={width ?? 96} height={height ?? 96} />;
}
