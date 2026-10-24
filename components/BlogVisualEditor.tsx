"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Package,
  Pilcrow,
  Quote,
  Redo2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isHtml, markdownToHtml } from "@/lib/blog-html";

type Tool = {
  label: string;
  icon: typeof Bold;
  run: () => void;
  /** document.queryCommandState name, to highlight the button while it applies. */
  state?: string;
};

/** What-you-see-is-what-you-get article editor. Saves HTML; the server cleans it before storing. */
export function BlogVisualEditor({
  value,
  onChange,
  uploadImage,
}: {
  value: string;
  onChange: (html: string) => void;
  uploadImage: (file: File) => Promise<string | null>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);

  // Load the starting content once; afterwards the editor owns its HTML so the cursor never jumps.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = isHtml(value) ? value : markdownToHtml(value);
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* older browsers */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const update = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel?.rangeCount || !el.contains(sel.anchorNode)) return;
      savedRange.current = sel.getRangeAt(0).cloneRange();
      const next: Record<string, boolean> = {};
      for (const name of ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight"]) {
        try {
          next[name] = document.queryCommandState(name);
        } catch {
          next[name] = false;
        }
      }
      setActive(next);
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  function emit() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  /** Put the cursor back where it was (prompts and file pickers take focus away). */
  function restore() {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }

  function exec(command: string, arg?: string) {
    restore();
    document.execCommand(command, false, arg);
    emit();
  }

  function addLink() {
    const selected = window.getSelection()?.toString() ?? "";
    const url = window.prompt("Link address (https://… or /product/…)")?.trim();
    if (!url) return;
    restore();
    if (selected) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "&quot;")}">${url}</a>`);
    emit();
  }

  function addProduct() {
    const input = window.prompt("Product page link or product slug, e.g. /product/brass-binoculars");
    const slug = input?.trim().replace(/^.*\/product\//, "").replace(/[/?#].*$/, "").toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return;
    exec("insertHTML", `<div data-product="${slug}" contenteditable="false">Product box: ${slug}</div><p><br></p>`);
  }

  const tools: (Tool | "|")[] = [
    { label: "Bold", icon: Bold, run: () => exec("bold"), state: "bold" },
    { label: "Italic", icon: Italic, run: () => exec("italic"), state: "italic" },
    { label: "Underline", icon: Underline, run: () => exec("underline"), state: "underline" },
    "|",
    { label: "Align left", icon: AlignLeft, run: () => exec("justifyLeft"), state: "justifyLeft" },
    { label: "Align center", icon: AlignCenter, run: () => exec("justifyCenter"), state: "justifyCenter" },
    { label: "Align right", icon: AlignRight, run: () => exec("justifyRight"), state: "justifyRight" },
    "|",
    { label: "Heading", icon: Heading2, run: () => exec("formatBlock", "<h2>") },
    { label: "Sub-heading", icon: Heading3, run: () => exec("formatBlock", "<h3>") },
    { label: "Normal text", icon: Pilcrow, run: () => exec("formatBlock", "<p>") },
    { label: "Quote", icon: Quote, run: () => exec("formatBlock", "<blockquote>") },
    "|",
    { label: "Image", icon: ImageIcon, run: () => fileRef.current?.click() },
    { label: "Bullet list", icon: List, run: () => exec("insertUnorderedList"), state: "insertUnorderedList" },
    { label: "Numbered list", icon: ListOrdered, run: () => exec("insertOrderedList"), state: "insertOrderedList" },
    "|",
    { label: "Add link", icon: Link2, run: addLink },
    { label: "Remove link", icon: Unlink, run: () => exec("unlink") },
    { label: "Product box", icon: Package, run: addProduct },
    { label: "Clear formatting", icon: Eraser, run: () => exec("removeFormat") },
    "|",
    { label: "Undo", icon: Undo2, run: () => exec("undo") },
    { label: "Redo", icon: Redo2, run: () => exec("redo") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-[#e6dfd2]">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-[#e6dfd2] bg-[#faf8f4] p-1.5">
        {tools.map((t, i) =>
          t === "|" ? (
            <span key={i} aria-hidden className="mx-1 h-5 w-px bg-[#e0d7c6]" />
          ) : (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={t.state ? Boolean(active[t.state]) : undefined}
              // Keep the text selection when a button is clicked.
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
              className={`grid h-8 w-8 place-items-center rounded text-navy-800 hover:bg-white ${
                t.state && active[t.state] ? "bg-white text-[#B8892F] shadow-sm" : ""
              }`}
            >
              <t.icon className="h-4 w-4" />
            </button>
          )
        )}
        {uploading ? <span className="ml-2 text-xs text-navy-600">Uploading image…</span> : null}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Article content"
        data-placeholder="Write your article content here…"
        onInput={emit}
        onBlur={emit}
        className="blog-content blog-editor min-h-80 p-4 text-[15px] leading-relaxed text-navy-800 outline-none"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setUploading(true);
          const url = await uploadImage(file);
          setUploading(false);
          if (url) exec("insertHTML", `<img src="${url.replace(/"/g, "&quot;")}" alt=""><p><br></p>`);
        }}
      />
    </div>
  );
}
