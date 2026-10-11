"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export function ProductGalleryViewer({
  images,
  alt,
  active,
  onActiveChange,
}: {
  images: string[];
  alt: string;
  active: number;
  onActiveChange: (i: number) => void;
}) {
  const [mode, setMode] = useState<"photo" | "360" | "3d">("photo");
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
    <div
      className="relative aspect-square overflow-hidden rounded-none bg-[#f5f5f5] lg:aspect-[5/4] lg:rounded-2xl lg:bg-[#2a2118]"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
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
          priority
        />
      </div>
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
  );
}
