"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, ImageIcon, Pencil, Trash2, X } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import type { ListingImage } from "@/lib/listing-images";
import { resolveMediaUrl } from "@/lib/media-url";
import { imageAdjustStyle, NEUTRAL_IMAGE_ADJUST, type ImageAdjust } from "@/lib/product-display";

function CameraCapture({
  stream,
  onCapture,
  onClose,
}: {
  stream: MediaStream | null;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(stream ? "" : "Camera permission was blocked. Allow the camera, or use Gallery / files.");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => setError("Camera is not ready. Use Gallery / files."));
    return () => {
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Camera is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not save the photo.");
          return;
        }
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-medium">Take product photo</p>
        <button type="button" aria-label="Close camera" onClick={onClose} className="rounded-full p-2">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
      </div>
      {error ? <p className="px-4 py-2 text-center text-sm text-red-200">{error}</p> : null}
      <div className="flex justify-center px-4 py-5">
        <button type="button" onClick={snap} className="btn-gold px-8" disabled={Boolean(error)}>
          Use this photo
        </button>
      </div>
    </div>,
    document.body
  );
}

export function AdminProductImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open the camera here. Use Gallery / files instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setCameraStream(stream);
    } catch {
      setError("Camera permission was blocked. Allow the camera, or use Gallery / files.");
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      let res: Response;
      try {
        res = await fetch("/api/upload", { method: "POST", body });
      } catch {
        setError(
          "Network error — could not reach /api/upload. Check that the site is running and you are logged in as admin."
        );
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      const url = data.path ?? data.url;
      if (url) onChange(String(url));
      else if (data.url) onChange(String(data.url));
      if (data.warning) setNotice(String(data.warning));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-navy-600">Product image</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => void openCamera()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-3 py-3 text-sm font-medium text-navy-800 hover:border-[#C9A84C] sm:flex-none sm:px-4"
        >
          <Camera className="h-4 w-4 shrink-0" />
          {uploading ? "Uploading…" : "Camera"}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-3 py-3 text-sm font-medium text-navy-800 hover:border-[#C9A84C] sm:flex-none sm:px-4"
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          Gallery / files
        </button>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        form="marina-image-picker"
        className="hidden"
        onChange={onPickFile}
      />
      {cameraStream ? (
        <CameraCapture
          stream={cameraStream}
          onClose={() => setCameraStream(null)}
          onCapture={(file) => {
            setCameraStream(null);
            const list = new DataTransfer();
            list.items.add(file);
            void onPickFile({ target: { files: list.files, value: "" } } as React.ChangeEvent<HTMLInputElement>);
          }}
        />
      ) : null}
      <p className="text-[11px] text-navy-500">Use Gallery on phones to pick existing photos. JPG, PNG, or WebP.</p>
      {value ? (
        <div className="flex items-start gap-3">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-[#e6dfd2]">
            <ProductImage src={value} alt="" fill className="object-cover" sizes="96px" />
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-red-700 underline"
            onClick={() => onChange("")}
          >
            Remove image
          </button>
        </div>
      ) : null}
      {value ? (
        <p className="truncate text-[10px] text-navy-500" title={value}>
          {resolveMediaUrl(value)}
        </p>
      ) : null}
      <input
        className="input text-sm"
        placeholder="Or paste image URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {notice ? <p className="text-xs text-amber-800">{notice}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

async function uploadImageFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  }
  const url = data.path ?? data.url;
  if (!url) throw new Error("Upload did not return an image address.");
  return { url: String(url), warning: data.warning ? String(data.warning) : "" };
}

export function AdminProductImagesField({
  images,
  onChange,
}: {
  images: ListingImage[];
  onChange: (images: ListingImage[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paste, setPaste] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open the camera here. Use Gallery / files instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setCameraStream(stream);
    } catch {
      setError("Camera permission was blocked. Allow the camera, or use Gallery / files.");
    }
  }

  function update(index: number, patch: Partial<ListingImage>) {
    onChange(images.map((image, i) => (i === index ? { ...image, ...patch } : image)));
  }

  function swap(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= images.length) return;
    const copy = [...images];
    const current = copy[index];
    copy[index] = copy[next];
    copy[next] = current;
    onChange(copy);
  }

  function moveTo(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
    const copy = [...images];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    onChange(copy);
  }

  async function addFiles(list: FileList | null) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    setError("");
    setNotice("");
    setUploading(true);
    const added: ListingImage[] = [];
    try {
      for (const file of files) {
        const uploaded = await uploadImageFile(file);
        added.push({ url: uploaded.url, name: "", color: "", text: "" });
        if (uploaded.warning) setNotice(uploaded.warning);
      }
      onChange([...images, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      if (added.length) onChange([...images, ...added]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-navy-600">Product images</span>
      <p className="text-[11px] text-navy-500">
        The first photo is the thumbnail. Drag to reorder. Edit opens brightness, colour, and zoom.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => void openCamera()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-3 py-3 text-sm font-medium text-navy-800 hover:border-[#C9A84C] sm:flex-none sm:px-4"
        >
          <Camera className="h-4 w-4 shrink-0" />
          {uploading ? "Uploading…" : "Camera"}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-3 py-3 text-sm font-medium text-navy-800 hover:border-[#C9A84C] sm:flex-none sm:px-4"
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          Gallery / files
        </button>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        form="marina-image-picker"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          e.target.value = "";
          if (!files.length) return;
          const transfer = new DataTransfer();
          files.forEach((file) => transfer.items.add(file));
          void addFiles(transfer.files);
        }}
      />
      {cameraStream ? (
        <CameraCapture
          stream={cameraStream}
          onClose={() => setCameraStream(null)}
          onCapture={(file) => {
            setCameraStream(null);
            const transfer = new DataTransfer();
            transfer.items.add(file);
            void addFiles(transfer.files);
          }}
        />
      ) : null}
      <div className="flex gap-2">
        <input
          className="input text-sm"
          placeholder="Or paste image URL"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <button
          type="button"
          className="btn-outline shrink-0 px-3 text-xs"
          onClick={() => {
            const url = paste.trim();
            if (!url) return;
            onChange([...images, { url, name: "", color: "", text: "" }]);
            setPaste("");
          }}
        >
          Add
        </button>
      </div>
      {images.length ? <p className="text-[11px] text-navy-500">Drag to reorder.</p> : null}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {images.map((image, index) => (
          <div
            key={`${image.url}-${index}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex != null) moveTo(dragIndex, index);
              setDragIndex(null);
            }}
            className="w-36 shrink-0"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#e6dfd2] bg-[#f7f4ee]">
              <ProductImage
                src={image.url}
                alt={image.name || "Product image"}
                fill
                className="object-cover"
                sizes="144px"
                style={imageAdjustStyle(image.adjust)}
              />
              {index === 0 ? (
                <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-navy-900 shadow">
                  Thumbnail
                </span>
              ) : null}
              <button
                type="button"
                aria-label="Delete image"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-white text-red-600 shadow"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Edit image"
                onClick={() => setEditing(index)}
                className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white text-navy-900 shadow"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex justify-center gap-1">
              <button
                type="button"
                aria-label="Move image left"
                disabled={index === 0}
                onClick={() => swap(index, -1)}
                className="grid h-7 w-7 place-items-center rounded-full border border-[#e6dfd2] text-navy-800 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move image right"
                disabled={index === images.length - 1}
                onClick={() => swap(index, 1)}
                className="grid h-7 w-7 place-items-center rounded-full border border-[#e6dfd2] text-navy-800 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="grid aspect-[4/3] w-36 shrink-0 place-items-center rounded-2xl border border-dashed border-[#cfc6b6] bg-[#faf8f4] text-center text-sm font-semibold text-navy-800"
        >
          <span>
            <ImageIcon className="mx-auto mb-1 h-5 w-5" />
            {uploading ? "Uploading…" : "Add photos"}
          </span>
        </button>
      </div>
      {editing != null && images[editing] ? (
        <ImageEditor
          image={images[editing]}
          onClose={() => setEditing(null)}
          onApply={(next) => {
            update(editing, next);
            setEditing(null);
          }}
        />
      ) : null}
      {notice ? <p className="text-xs text-amber-800">{notice}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

const ADJUST_TOOLS: { key: keyof ImageAdjust; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Brightness", min: 40, max: 160 },
  { key: "exposure", label: "Exposure", min: -100, max: 100 },
  { key: "shadows", label: "Shadows", min: -100, max: 100 },
  { key: "highlights", label: "Highlights", min: -100, max: 100 },
  { key: "blacks", label: "Blacks", min: -100, max: 100 },
  { key: "whites", label: "Whites", min: -100, max: 100 },
  { key: "contrast", label: "Contrast", min: 40, max: 160 },
  { key: "saturation", label: "Saturation", min: -100, max: 100 },
  { key: "temperature", label: "Temperature", min: -100, max: 100 },
  { key: "sharpness", label: "Sharpness", min: -100, max: 100 },
  { key: "clarity", label: "Clarity", min: -100, max: 100 },
];

function ImageEditor({
  image,
  onClose,
  onApply,
}: {
  image: ListingImage;
  onClose: () => void;
  onApply: (next: Partial<ListingImage>) => void;
}) {
  const [draft, setDraft] = useState<ListingImage>({
    ...image,
    adjust: { ...NEUTRAL_IMAGE_ADJUST, ...image.adjust },
  });
  const [past, setPast] = useState<ListingImage[]>([]);
  const [future, setFuture] = useState<ListingImage[]>([]);
  const [mode, setMode] = useState<"adjust" | "transform">("adjust");
  const [tool, setTool] = useState<keyof ImageAdjust>("brightness");

  function remember() {
    setPast((items) => [...items.slice(-30), draft]);
    setFuture([]);
  }

  function undo() {
    setPast((items) => {
      const previous = items[items.length - 1];
      if (!previous) return items;
      setFuture((queue) => [draft, ...queue]);
      setDraft(previous);
      return items.slice(0, -1);
    });
  }

  function redo() {
    setFuture((items) => {
      const next = items[0];
      if (!next) return items;
      setPast((queue) => [...queue, draft]);
      setDraft(next);
      return items.slice(1);
    });
  }

  const activeTool = ADJUST_TOOLS.find((item) => item.key === tool) ?? ADJUST_TOOLS[0];
  const adjust = draft.adjust ?? NEUTRAL_IMAGE_ADJUST;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#eee] px-4 py-3">
        <div className="flex gap-3 text-sm">
          <button type="button" className="text-navy-600 disabled:opacity-30" disabled={!past.length} onClick={undo}>
            Undo
          </button>
          <button type="button" className="text-navy-600 disabled:opacity-30" disabled={!future.length} onClick={redo}>
            Redo
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-full bg-[#222] px-5 py-2 text-sm font-semibold text-white" onClick={() => onApply(draft)}>
            Apply
          </button>
          <button type="button" className="rounded-full border border-[#ddd] px-5 py-2 text-sm font-semibold" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f3f3f3]">
        <ProductImage src={draft.url} alt="" fill className="object-contain" sizes="100vw" style={imageAdjustStyle(adjust)} />
        {draft.text ? (
          <span
            className="pointer-events-none absolute z-[2] max-w-[80%] -translate-x-1/2 -translate-y-1/2 text-center text-lg font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]"
            style={{ left: `${draft.textX ?? 50}%`, top: `${draft.textY ?? 50}%` }}
          >
            {draft.text}
          </span>
        ) : null}
      </div>
      <div className="max-h-[46vh] overflow-y-auto border-t border-[#eee] px-4 py-4">
        <div className="mx-auto grid max-w-5xl gap-2 sm:grid-cols-3">
          <input className="input text-sm" placeholder="Image name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="input text-sm" placeholder="Color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
          <input
            className="input text-sm"
            placeholder="Text on this image"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value, textX: draft.textX ?? 50, textY: draft.textY ?? 50 })}
          />
        </div>
        {mode === "adjust" ? (
          <div className="mx-auto mt-4 max-w-5xl">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
              {ADJUST_TOOLS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTool(item.key)}
                  className={`rounded-xl px-2 py-3 text-center text-[11px] font-medium ${
                    tool === item.key ? "bg-[#222] text-white" : "bg-[#ececec] text-[#333]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs text-navy-700">
              <span className="mb-1 flex justify-between">
                {activeTool.label}
                <span>{adjust[activeTool.key] ?? 0}</span>
              </span>
              <input
                type="range"
                min={activeTool.min}
                max={activeTool.max}
                value={Number(adjust[activeTool.key] ?? (activeTool.key === "brightness" || activeTool.key === "contrast" ? 100 : 0))}
                onPointerDown={remember}
                onChange={(e) => setDraft({ ...draft, adjust: { ...adjust, [activeTool.key]: Number(e.target.value) } })}
                className="w-full"
              />
            </label>
          </div>
        ) : (
          <label className="mx-auto mt-4 block max-w-lg text-xs text-navy-700">
            <span className="mb-1 flex justify-between">
              Zoom
              <span>{adjust.zoom}%</span>
            </span>
            <input
              type="range"
              min={50}
              max={180}
              value={adjust.zoom}
              onPointerDown={remember}
              onChange={(e) => setDraft({ ...draft, adjust: { ...adjust, zoom: Number(e.target.value) } })}
              className="w-full"
            />
          </label>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={() => setMode("adjust")} className={`rounded-full px-5 py-2 text-sm font-semibold ${mode === "adjust" ? "bg-[#222] text-white" : "border border-[#ddd]"}`}>
            Adjust
          </button>
          <button type="button" onClick={() => setMode("transform")} className={`rounded-full px-5 py-2 text-sm font-semibold ${mode === "transform" ? "bg-[#222] text-white" : "border border-[#ddd]"}`}>
            Transform
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
