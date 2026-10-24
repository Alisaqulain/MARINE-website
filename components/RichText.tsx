import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Small Markdown-style renderer for admin-written text (product descriptions, blog articles).
 * Supports: # / ## / ### headings, **bold**, *italic*, __underline__, [text](url), ![alt](src),
 * "- " and "1. " lists, "> " quotes, and [[product:slug]] embeds (rendered by `renderProduct`).
 */

type Block =
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "para"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "product"; slug: string };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ kind: "para", text: para.join(" ") });
    if (list) blocks.push(list);
    if (quote.length) blocks.push({ kind: "quote", text: quote.join(" ") });
    para = [];
    list = null;
    quote = [];
  };

  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s*(.*)$/.exec(line);
    if (heading) {
      flush();
      if (heading[2]) blocks.push({ kind: "heading", level: (heading[1].length + 1) as 2 | 3 | 4, text: heading[2] });
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (image) {
      flush();
      blocks.push({ kind: "image", alt: image[1], src: image[2] });
      continue;
    }
    const product = /^\[\[product:([a-z0-9-]+)\]\]$/i.exec(line);
    if (product) {
      flush();
      blocks.push({ kind: "product", slug: product[1] });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      if (para.length || quote.length || (list && list.kind !== kind)) flush();
      list ??= { kind, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    if (line.startsWith(">")) {
      if (para.length || list) flush();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    if (list || quote.length) flush();
    para.push(line);
  }
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
    if (part.startsWith("__") && part.endsWith("__")) return <u key={i}>{inline(part.slice(2, -2))}</u>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = link[2];
      const external = /^https?:\/\//i.test(href);
      return external ? (
        <a key={i} href={href} target="_blank" rel="noreferrer" className="text-[#8C6E28] underline">
          {link[1]}
        </a>
      ) : (
        <Link key={i} href={href} className="text-[#8C6E28] underline">
          {link[1]}
        </Link>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{inline(part.slice(1, -1))}</em>;
    return part;
  });
}

/** Text with Markdown markers removed, for word counts and previews. */
export function plainText(source: string) {
  return source
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[product:[^\]]+\]\]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>]/g, "")
    .trim();
}

export function RichText({
  source,
  className = "",
  renderProduct,
}: {
  source: string;
  className?: string;
  renderProduct?: (slug: string) => ReactNode;
}) {
  const blocks = parse(source);
  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading": {
            const cls =
              b.level === 2
                ? "font-serif text-xl font-semibold text-navy-900 md:text-2xl pt-2"
                : b.level === 3
                  ? "font-serif text-lg font-semibold text-navy-900 md:text-xl pt-1"
                  : "text-base font-semibold text-navy-900";
            const Tag = `h${b.level}` as "h2" | "h3" | "h4";
            return (
              <Tag key={i} className={cls}>
                {inline(b.text)}
              </Tag>
            );
          }
          case "para":
            return <p key={i}>{inline(b.text)}</p>;
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-[#C9A84C]">
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-[#8C6E28]">
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="relative rounded-xl bg-[#FAF3E6] px-6 py-5 pl-14 font-serif text-lg italic text-navy-800"
              >
                <span aria-hidden className="absolute left-5 top-2 font-serif text-5xl leading-none text-[#C9A84C]">
                  &ldquo;
                </span>
                {inline(b.text)}
              </blockquote>
            );
          case "image":
            return (
              // Admin images can come from any upload host, so a plain img avoids next/image domain config.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={b.src} alt={b.alt} loading="lazy" className="w-full rounded-xl object-cover" />
            );
          case "product":
            return renderProduct ? <div key={i}>{renderProduct(b.slug)}</div> : null;
        }
      })}
    </div>
  );
}
