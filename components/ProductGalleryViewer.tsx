"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ImageOverlayText } from "@/components/ImageOverlayText";

function pointerPercent(e: { clientX: number; clientY: number; currentTarget: Element }) {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
  };
}

export function ProductGalleryViewer({
  images,
  alt,
  active,
  onActiveChange,
  imageStyle,
  caption,
  textX,
  textY,
  title,
  priceLabel,
}: {
  images: string[];
  alt: string;
  active: number;
  onActiveChange: (i: number) => void;
  imageStyle?: CSSProperties;
  caption?: string;
  textX?: number;
  textY?: number;
  title?: string;
  priceLabel?: string;
}) {
  const [mode, setMode] = useState<"photo" | "360" | "3d">("photo");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [magnified, setMagnified] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [tilt, setTilt] = useState({ x: 8, y: -18 });
  const [spin, setSpin] = useState(0);
  const [dragging, setDragging] = useState(false);
  const frame = useRef<number | null>(null);
  const activeRef = useRef(active);
  const onActiveRef = useRef(onActiveChange);
  const drag = useRef<{ x: number; y: number; active: number; spin: number; tiltX: number; tiltY: number } | null>(null);

  activeRef.current = active;
  onActiveRef.current = onActiveChange;
  const src = images[active] ?? images[0];
  const interactive = mode !== "photo";

  useEffect(() => {
    if (mode !== "360" || images.length < 2 || dragging) return;
    const id = window.setInterval(() => {
      const next = (activeRef.current + 1) % images.length;
      onActiveRef.current(next);
    }, 700);
    return () => window.clearInterval(id);
  }, [mode, images.length, dragging]);

  useEffect(() => {
    if (mode !== "360" || images.length > 1 || dragging) return;
    const id = window.setInterval(() => setSpin((value) => value + 1.4), 30);
    return () => window.clearInterval(id);
  }, [mode, images.length, dragging]);

  useEffect(() => {
    if (mode !== "3d" || dragging) return;
    const id = window.setInterval(() => {
      setTilt((value) => ({ x: value.x, y: value.y + 0.6 }));
    }, 30);
    return () => window.clearInterval(id);
  }, [mode, dragging]);

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
      if (e.key === "Escape") {
        setZoomOpen(false);
        setMagnified(false);
      }
      if (e.key === "ArrowRight") onActiveRef.current((activeRef.current + 1) % images.length);
      if (e.key === "ArrowLeft") onActiveRef.current((activeRef.current - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [zoomOpen, images.length]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, active, spin, tiltX: tilt.x, tiltY: tilt.y };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (mode === "360" && images.length > 1) {
      const step = Math.trunc(dx / 36);
      const next = (start.active + step + images.length * 20) % images.length;
      if (next !== activeRef.current) onActiveRef.current(next);
      return;
    }
    if (mode === "360") {
      setSpin(start.spin + dx * 0.7);
      return;
    }
    setTilt({
      x: Math.max(-40, Math.min(40, start.tiltX + dy * -0.25)),
      y: start.tiltY + dx * 0.45,
    });
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  function closeZoom() {
    setZoomOpen(false);
    setMagnified(false);
  }

  function showImage(index: number) {
    if (!images.length) return;
    setMagnified(false);
    onActiveChange((index + images.length) % images.length);
  }

  const transform =
    mode === "3d"
      ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.04)`
      : mode === "360" && images.length < 2
        ? `perspective(900px) rotateY(${spin}deg)`
        : undefined;

  return (
    <>
      <div
        className="relative aspect-square overflow-hidden rounded-none bg-[#f5f5f5] lg:aspect-[5/4] lg:rounded-2xl lg:bg-[#2a2118]"
        style={{ touchAction: interactive ? "none" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <button
          type="button"
          aria-label={interactive ? "Drag to rotate" : "Zoom image"}
          onClick={() => {
            if (!interactive) setZoomOpen(true);
          }}
          className={`relative block h-full w-full ${interactive ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        >
          <div
            className="relative h-full w-full transition-transform duration-150 ease-out"
            style={transform ? { transform } : undefined}
          >
            <Image
              src={src}
              alt={alt}
              fill
              className="object-contain p-4 lg:object-cover lg:p-0"
              style={imageStyle}
              priority
            />
            <ImageOverlayText text={caption} x={textX} y={textY} className="top-4" />
          </div>
        </button>
        {interactive ? (
          <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[10px] uppercase tracking-widest text-white">
            {mode === "360" && images.length > 1 ? "Drag to spin the photos" : "Drag to rotate"}
          </p>
        ) : null}
        <div
          className="absolute bottom-4 left-4 z-10 flex gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setMode(mode === "360" ? "photo" : "360");
              setDragging(false);
            }}
            className={`rounded-md px-2.5 py-1 text-[10px] uppercase tracking-widest ${
              mode === "360" ? "bg-[#C9A84C] text-[#031D38]" : "bg-black/70 text-white"
            }`}
          >
            360°
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "3d" ? "photo" : "3d");
              setDragging(false);
              setTilt({ x: 8, y: -18 });
            }}
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
          className="fixed inset-0 z-[120] flex bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-label="Product photos"
          onClick={closeZoom}
        >
          <div className="flex h-full w-full" onClick={(e) => e.stopPropagation()}>
            {images.length > 1 ? (
              <div className="hidden w-[76px] shrink-0 flex-col gap-2 overflow-y-auto bg-black/50 p-2 md:flex">
                {images.map((image, index) => (
                  <button
                    key={`rail-${image}-${index}`}
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    onClick={() => showImage(index)}
                    className={`relative aspect-square shrink-0 overflow-hidden rounded-md bg-white ${
                      index === active ? "ring-2 ring-white" : "opacity-70 ring-1 ring-white/20"
                    }`}
                  >
                    <Image src={image} alt="" fill className="object-cover" sizes="76px" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="relative min-w-0 flex-1 overflow-hidden bg-black">
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => showImage(active - 1)}
                    className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[#222] shadow-lg"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => showImage(active + 1)}
                    className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[#222] shadow-lg md:right-6"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                aria-label={magnified ? "Zoom out" : "Zoom in"}
                onClick={(e) => {
                  if (window.matchMedia("(hover: none)").matches) {
                    setZoomOrigin(pointerPercent(e));
                    setMagnified((value) => !value);
                  }
                }}
                onPointerMove={(e) => {
                  if (e.pointerType !== "mouse") return;
                  setZoomOrigin(pointerPercent(e));
                  if (!magnified) setMagnified(true);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") setMagnified(false);
                }}
                className={`relative block h-full w-full overflow-hidden ${magnified ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                style={{ touchAction: magnified ? "none" : undefined }}
              >
                <div
                  className={`relative h-full w-full ${magnified ? "transition-none" : "transition-transform duration-200"}`}
                  style={{
                    transform: magnified ? "scale(2.5)" : undefined,
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                  }}
                >
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-contain"
                    style={imageStyle}
                    sizes="80vw"
                    priority
                  />
                  <ImageOverlayText text={caption} x={textX} y={textY} />
                </div>
              </button>
              <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/90">
                {magnified ? "Move to look around" : "Move over the photo to zoom · tap on mobile"}
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={closeZoom}
                className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-[#222] shadow-lg md:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <aside className="hidden w-[280px] shrink-0 flex-col overflow-y-auto bg-[#141414] p-4 text-white md:flex xl:w-[340px]">
              <button
                type="button"
                aria-label="Close"
                onClick={closeZoom}
                className="mb-3 grid h-10 w-10 place-items-center self-end rounded-full bg-white text-[#222]"
              >
                <X className="h-5 w-5" />
              </button>
              {title ? <h2 className="text-lg font-medium leading-snug">{title}</h2> : null}
              {priceLabel ? <p className="mt-2 text-xl font-semibold">{priceLabel}</p> : null}
              {images.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {images.map((image, index) => (
                    <button
                      key={`side-${image}-${index}`}
                      type="button"
                      aria-label={`Show image ${index + 1}`}
                      onClick={() => showImage(index)}
                      className={`relative aspect-square overflow-hidden rounded-md bg-white ${
                        index === active ? "ring-2 ring-[#C9A84C]" : "ring-1 ring-white/15"
                      }`}
                    >
                      <Image src={image} alt="" fill className="object-cover" sizes="160px" />
                    </button>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>
          {images.length > 1 ? (
            <div
              className="absolute inset-x-0 bottom-0 z-20 flex gap-2 overflow-x-auto bg-black/70 p-2 md:hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((image, index) => (
                <button
                  key={`mobile-${image}-${index}`}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    showImage(index);
                  }}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md ${
                    index === active ? "ring-2 ring-white" : "opacity-70"
                  }`}
                >
                  <Image src={image} alt="" fill className="object-cover" sizes="56px" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
