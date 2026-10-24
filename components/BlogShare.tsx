"use client";

import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

const icons = {
  facebook: "M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z",
  x: "M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z",
  linkedin:
    "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3V9.75zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.75z",
  pinterest:
    "M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.2-1.9 3.2-4.7 0-2.5-1.8-4.2-4.3-4.2-2.9 0-4.6 2.2-4.6 4.4 0 .9.3 1.8.8 2.3l.1.4-.3 1.2c0 .2-.2.3-.4.2-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2.1-1.3 2.8A10 10 0 1 0 12 2z",
};

export function BlogShare({ title }: { title: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, path: icons.facebook, cls: "text-[#1877F2]" },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, path: icons.x, cls: "text-black" },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, path: icons.linkedin, cls: "text-[#0A66C2]" },
    { name: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`, path: icons.pinterest, cls: "text-[#E60023]" },
  ];
  return (
    <div>
      <p className="text-sm font-semibold text-navy-900">Share this article</p>
      <div className="mt-3 flex items-center gap-2">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Share on ${l.name}`}
            className={`grid h-9 w-9 place-items-center rounded-full border border-[#e6dfd2] bg-white hover:bg-[#FAF7F2] ${l.cls}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
              <path d={l.path} />
            </svg>
          </a>
        ))}
        <a
          href={`https://wa.me/?text=${t}%20${u}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on WhatsApp"
          className="grid h-9 w-9 place-items-center rounded-full border border-[#e6dfd2] bg-white text-[#25D366] hover:bg-[#FAF7F2]"
        >
          <WhatsAppIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
