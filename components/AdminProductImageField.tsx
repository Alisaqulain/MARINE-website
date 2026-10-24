"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, Crop, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import type { ListingImage } from "@/lib/listing-images";
import { resolveMediaUrl } from "@/lib/media-url";
import { imageAdjustStyle, NEUTRAL_IMAGE_ADJUST, type ImageAdjust } from "@/lib/product-display";

/** Phones often reload the admin page when the camera or gallery closes. Keep the dashboard address first. */
function rememberAdminDashboard() {
  if (typeof window === "undefined") return;
  try {
    const here = new URL(window.location.href);
    const tab = here.searchParams.get("tab") || sessionStorage.getItem("marina-admin-tab") || "add-product";
    const panel = here.searchParams.get("panel") || sessionStorage.getItem("marina-admin-panel") || "customer";
    sessionStorage.setItem("marina-admin-tab", tab);
    sessionStorage.setItem("marina-admin-panel", panel);
    if (!here.pathname.startsWith("/admin")) {
      window.location.assign(`/admin?tab=${encodeURIComponent(tab)}&panel=${encodeURIComponent(panel)}`);
      return;
    }
    here.searchParams.set("tab", tab);
    here.searchParams.set("panel", panel);
    window.history.replaceState(window.history.state, "", here);
  } catch {
    /* ignore */
  }
}

/**
 * Native file inputs, not an in-page camera. A clipped hidden input never opens the phone
 * camera or gallery. The input fills the button so the tap is a real user gesture.
 */
function PhotoPickerButtons({
  uploading,
  multiple = false,
  onFiles,
}: {
  uploading: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const cls =
    "relative inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-[#C9A84C]/50 bg-[#FAF7F2] px-3 py-3 text-sm font-medium text-navy-800 hover:border-[#C9A84C] sm:flex-none sm:px-4";
  const inputCls = "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0";

  function take(list: FileList | null) {
    const files = list ? [...list] : [];
    if (files.length) onFiles(files);
  }

  return (
    <div className={`flex flex-wrap gap-2 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
      <label className={cls}>
        <Camera className="h-4 w-4 shrink-0" />
        Take photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className={inputCls}
          disabled={uploading}
          onClick={rememberAdminDashboard}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <label className={cls}>
        <ImageIcon className="h-4 w-4 shrink-0" />
        {uploading ? "Uploading…" : multiple ? "Choose photos (multiple)" : "Choose from gallery"}
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          className={inputCls}
          disabled={uploading}
          onClick={rememberAdminDashboard}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
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

  async function uploadSingle(file: File) {
    setError("");
    setNotice("");
    setUploading(true);
    try {
      const uploaded = await uploadImageFile(file);
      onChange(uploaded.url);
      if (uploaded.warning) setNotice(uploaded.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-navy-600">Product image</span>
      <PhotoPickerButtons uploading={uploading} onFiles={(files) => void uploadSingle(files[0])} />
      <p className="text-[11px] text-navy-500">
        Take a photo with the phone camera or choose one from your gallery. If the phone reloads this page, it opens the admin dashboard again. Large photos are resized automatically.
      </p>
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

const MAX_EDGE = 2000;

/**
 * Phone photos are often 3–12 MB (and sometimes HEIC). Re-encode them to a ~2000px JPEG
 * in the browser so uploads stay small enough for nginx / mobile data.
 * Falls back to the original file if the browser cannot decode it.
 */
async function prepareImage(file: File): Promise<File> {
  const webSafe = /^image\/(jpeg|png|webp|gif)$/.test(file.type);
  if (webSafe && file.size <= 900 * 1024) return file;
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    const base = (file.name || "photo").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadImageFile(original: File) {
  const file = await prepareImage(original);
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
  const [editing, setEditing] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setError("");
    setNotice("");
    setUploading(true);
    const added: ListingImage[] = [];
    try {
      for (const [i, file] of files.entries()) {
        if (files.length > 1) setNotice(`Uploading ${i + 1} of ${files.length}…`);
        const uploaded = await uploadImageFile(file);
        added.push({ url: uploaded.url, name: "", color: "", text: "" });
        if (uploaded.warning) setNotice(uploaded.warning);
        else if (i === files.length - 1) setNotice("");
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
        The first photo is the thumbnail. You can pick several photos at once. Drag to reorder. Edit opens
        crop &amp; frame, brightness, colour, and zoom.
      </p>
      <PhotoPickerButtons uploading={uploading} multiple onFiles={(files) => void addFiles(files)} />
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
        <label
          className={`relative grid aspect-[4/3] w-36 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-[#cfc6b6] bg-[#faf8f4] text-center text-sm font-semibold text-navy-800 ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <span>
            <ImageIcon className="mx-auto mb-1 h-5 w-5" />
            {uploading ? "Uploading…" : "Add photos"}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            disabled={uploading}
            onClick={rememberAdminDashboard}
            onChange={(e) => {
              const files = e.target.files ? [...e.target.files] : [];
              e.target.value = "";
              if (files.length) void addFiles(files);
            }}
          />
        </label>
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
  const [cropping, setCropping] = useState(false);
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
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setCropping(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd] px-5 py-2 text-sm font-semibold">
            <Crop className="h-4 w-4" />
            Crop &amp; frame
          </button>
          <button type="button" onClick={() => setMode("adjust")} className={`rounded-full px-5 py-2 text-sm font-semibold ${mode === "adjust" ? "bg-[#222] text-white" : "border border-[#ddd]"}`}>
            Adjust
          </button>
          <button type="button" onClick={() => setMode("transform")} className={`rounded-full px-5 py-2 text-sm font-semibold ${mode === "transform" ? "bg-[#222] text-white" : "border border-[#ddd]"}`}>
            Transform
          </button>
        </div>
      </div>
      {cropping ? (
        <CropTool
          src={draft.url}
          onCancel={() => setCropping(false)}
          onCropped={(url) => {
            remember();
            setDraft({ ...draft, url });
            setCropping(false);
          }}
        />
      ) : null}
    </div>,
    document.body
  );
}

type CropRect = { x: number; y: number; w: number; h: number };

const CROP_FRAMES: { label: string; ratio: number | null }[] = [
  { label: "Free", ratio: null },
  { label: "Square 1:1", ratio: 1 },
  { label: "Portrait 4:5", ratio: 4 / 5 },
  { label: "Portrait 3:4", ratio: 3 / 4 },
  { label: "Landscape 4:3", ratio: 4 / 3 },
  { label: "Wide 16:9", ratio: 16 / 9 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Largest centred crop (in % of the image) with the given pixel aspect ratio. */
function fitCrop(ratio: number | null, natW: number, natH: number): CropRect {
  if (!ratio) return { x: 5, y: 5, w: 90, h: 90 };
  const imageRatio = natW / natH;
  let w = 90;
  let h = 90;
  if (ratio > imageRatio) h = (90 * imageRatio) / ratio;
  else w = (90 * ratio) / imageRatio;
  return { x: (100 - w) / 2, y: (100 - h) / 2, w, h };
}

/** Crops the photo to a frame, then uploads the cropped copy and hands back its URL. */
function CropTool({
  src,
  onCancel,
  onCropped,
}: {
  src: string;
  onCancel: () => void;
  onCropped: (url: string) => void;
}) {
  const resolved = resolveMediaUrl(src) || src;
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [rect, setRect] = useState<CropRect>({ x: 5, y: 5, w: 90, h: 90 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "move" | "resize"; x: number; y: number; rect: CropRect } | null>(null);

  function chooseFrame(next: number | null) {
    setRatio(next);
    if (nat) setRect(fitCrop(next, nat.w, nat.h));
  }

  function startDrag(kind: "move" | "resize", e: React.PointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, rect };
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!start || !box || !nat) return;
    const dx = ((e.clientX - start.x) / box.width) * 100;
    const dy = ((e.clientY - start.y) / box.height) * 100;
    const r = start.rect;
    if (start.kind === "move") {
      setRect({ ...r, x: clamp(r.x + dx, 0, 100 - r.w), y: clamp(r.y + dy, 0, 100 - r.h) });
      return;
    }
    let w = clamp(r.w + dx, 5, 100 - r.x);
    let h = ratio ? (w * nat.w) / (nat.h * ratio) : clamp(r.h + dy, 5, 100 - r.y);
    if (ratio && r.y + h > 100) {
      h = 100 - r.y;
      w = (h * nat.h * ratio) / nat.w;
    }
    setRect({ ...r, w, h });
  }

  function endDrag() {
    drag.current = null;
  }

  async function apply() {
    if (!nat) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(resolved);
      if (!res.ok) throw new Error("");
      const bitmap = await createImageBitmap(await res.blob());
      const sx = (rect.x / 100) * bitmap.width;
      const sy = (rect.y / 100) * bitmap.height;
      const sw = (rect.w / 100) * bitmap.width;
      const sh = (rect.h / 100) * bitmap.height;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("");
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("");
      const uploaded = await uploadImageFile(new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onCropped(uploaded.url);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not crop this image. Pasted links from other websites cannot be cropped — upload the photo instead."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[230] flex flex-col bg-[#111] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-sm font-medium">Crop &amp; frame</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !nat}
            onClick={() => void apply()}
            className="rounded-full bg-[#C9A84C] px-5 py-2 text-sm font-semibold text-[#111] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Apply crop"}
          </button>
          <button type="button" onClick={onCancel} className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold">
            Cancel
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        <div
          ref={boxRef}
          className="relative inline-block touch-none select-none overflow-hidden"
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            src={resolved}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNat({ w: img.naturalWidth, h: img.naturalHeight });
              setRect(fitCrop(ratio, img.naturalWidth, img.naturalHeight));
            }}
            className="block max-h-[calc(100dvh-220px)] max-w-full"
          />
          {nat ? (
            <div
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
              onPointerDown={(e) => startDrag("move", e)}
            >
              <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" />
              <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" />
              <span
                aria-label="Resize crop"
                onPointerDown={(e) => startDrag("resize", e)}
                className="absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize rounded-tl-md border-l-2 border-t-2 border-white bg-[#C9A84C]"
              />
            </div>
          ) : null}
        </div>
      </div>
      {error ? <p className="px-4 pb-2 text-center text-sm text-red-300">{error}</p> : null}
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-4 sm:justify-center">
        {CROP_FRAMES.map((frame) => (
          <button
            key={frame.label}
            type="button"
            onClick={() => chooseFrame(frame.ratio)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              ratio === frame.ratio ? "bg-white text-[#111]" : "border border-white/30 text-white"
            }`}
          >
            {frame.label}
          </button>
        ))}
      </div>
      <p className="pb-4 text-center text-[11px] text-white/60">Drag the frame to move it · drag the gold corner to resize</p>
    </div>
  );
}
