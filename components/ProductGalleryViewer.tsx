"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ImageOverlayText } from "@/components/ImageOverlayText";

export function ProductGalleryViewer({
  images,
  alt,
  active,
  onActiveChange,
  imageStyle,
  caption,
}: {
  images: string[];
  alt: string;
  active: number;
  onActiveChange: (i: number) => void;
  imageStyle?: CSSProperties;
  caption?: string;
}) {
  const [mode, setMode] = useState<"photo" | "360" | "3d">("photo");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  const src = images[active] ?? images[0];

  useEffect(() => {
    if (mode !== "360" || images.length < 2) return;
    let idx = active;
    const id = window.setInterval(() => {
      idx = (idx + 1) % images.length;
      onActiveChange(idx);
    }, 450);
    return () => window.clearInterval(id);
  }, [mode, images.length, active, onActiveChange]);

  useEffect(() => {
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    if (!zoomOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomOpen(false);
      if (e.key === "ArrowRight") onActiveChange((active + 1) % images.length);
      if (e.key === "ArrowLeft") onActiveChange((active - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [zoomOpen, active, images.length, onActiveChange]);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (mode !== "3d") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: py * -18, y: px * 22 });
    },
    [mode]
  );

  return (
    <>
    <div
      className="relative aspect-square overflow-hidden rounded-none bg-[#f5f5f5] lg:aspect-[5/4] lg:rounded-2xl lg:bg-[#2a2118]"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <button
        type="button"
        aria-label="Zoom image"
        onClick={() => setZoomOpen(true)}
        className="relative block h-full w-full cursor-zoom-in"
      >
      <div
        className="relative h-full w-full transition-transform duration-150 ease-out"
        style={
          mode === "3d"
            ? {
                transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`,
              }
            : undefined
        }
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain p-4 lg:object-cover lg:p-0"
          style={imageStyle}
          priority
        />
        <ImageOverlayText text={caption} className="top-4" />
      </div>
      </button>
      <div className="absolute bottom-4 left-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === "360" ? "photo" : "360")}
          className={`rounded-md px-2.5 py-1 text-[10px] uppercase tracking-widest ${
            mode === "360" ? "bg-[#C9A84C] text-[#031D38]" : "bg-black/70 text-white"
          }`}
        >
          360°
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "3d" ? "photo" : "3d")}
          className={`rounded-md px-2.5 py-1 text-[10px] uppercase tracking-widest ${
            mode === "3d" ? "bg-[#C9A84C] text-[#031D38]" : "bg-white/90 text-navy-900"
          }`}
        >
          3D view
        </button>
      </div>
    </div>
      {zoomOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed product image"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            aria-label="Close zoom"
            onClick={() => setZoomOpen(false)}
            className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-[#222] shadow-lg sm:right-5 sm:top-5"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="flex h-[min(88vh,820px)] w-full max-w-6xl items-stretch gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative min-w-0 flex-1 overflow-hidden bg-white">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-contain"
                style={imageStyle}
                sizes="90vw"
                priority
              />
              <ImageOverlayText text={caption} className="top-4" />
            </div>
            {images.length > 1 ? (
              <div className="flex w-[72px] shrink-0 flex-col gap-2 overflow-y-auto sm:w-[92px]">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    onClick={() => onActiveChange(index)}
                    className={`relative aspect-square overflow-hidden bg-white ${
                      index === active ? "ring-2 ring-[#C9A84C]" : "ring-1 ring-white/40"
                    }`}
                  >
                    <Image src={image} alt="" fill className="object-cover" sizes="92px" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
