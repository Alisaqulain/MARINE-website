/**
 * Blog articles are stored as HTML from the admin's visual editor. Older posts are
 * Markdown-style text; `toArticleHtml` converts those so both render the same way.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "h2", "h3", "h4", "ul", "ol", "li",
  "blockquote", "a", "img", "div", "span", "hr", "figure", "figcaption",
]);

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeUrl(url: string) {
  const u = url.trim();
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u) && !/^\/\//.test(u) ? u : "";
}

function readAttrs(raw: string) {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return attrs;
}

/** Keep only formatting tags and safe attributes (links, images, text alignment, product boxes). */
export function sanitizeArticleHtml(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|noscript|template)[\s\S]*?<\/\1\s*>/gi, "");
  return cleaned.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_all, close: string, name: string, rawAttrs: string) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (close) return tag === "br" || tag === "img" || tag === "hr" ? "" : `</${tag}>`;
    const attrs = readAttrs(rawAttrs);
    const out: string[] = [];
    const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(attrs.style ?? "")?.[1];
    if (align) out.push(`style="text-align:${align.toLowerCase()}"`);
    if (attrs.align && /^(left|center|right|justify)$/i.test(attrs.align)) out.push(`style="text-align:${attrs.align.toLowerCase()}"`);
    if (tag === "a") {
      const href = safeUrl(attrs.href ?? "");
      if (href) out.push(`href="${escapeAttr(href)}"`);
      // Other websites open in a new tab; our own pages open in place.
      if (attrs.target === "_blank" || /^https?:\/\//i.test(href)) out.push('target="_blank" rel="noopener noreferrer"');
    }
    if (tag === "img") {
      const src = safeUrl(attrs.src ?? "");
      if (!src) return "";
      out.push(`src="${escapeAttr(src)}"`, `alt="${escapeAttr(attrs.alt ?? "")}"`, 'loading="lazy"');
    }
    if (tag === "div" && attrs["data-product"] && /^[a-z0-9-]+$/i.test(attrs["data-product"])) {
      out.push(`data-product="${attrs["data-product"].toLowerCase()}"`);
    }
    return `<${tag}${out.length ? " " + out.join(" ") : ""}>`;
  });
}

function inlineMarkdown(text: string) {
  return escapeText(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => `<a href="${escapeAttr(href)}">${label}</a>`);
}

/** Convert the older Markdown-style text to HTML. */
export function markdownToHtml(source: string): string {
  const out: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let para: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inlineMarkdown(para.join(" "))}</p>`);
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMarkdown(i)}</li>`).join("")}</${list.tag}>`);
    if (quote.length) out.push(`<blockquote>${inlineMarkdown(quote.join(" "))}</blockquote>`);
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
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    const product = /^\[\[product:([a-z0-9-]+)\]\]$/i.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      if (heading[2]) out.push(`<h${heading[1].length + 1}>${inlineMarkdown(heading[2])}</h${heading[1].length + 1}>`);
    } else if (image) {
      flush();
      out.push(`<img src="${escapeAttr(image[2])}" alt="${escapeAttr(image[1])}">`);
    } else if (product) {
      flush();
      out.push(`<div data-product="${product[1].toLowerCase()}"></div>`);
    } else if (bullet || numbered) {
      const tag = bullet ? "ul" : "ol";
      if (para.length || quote.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (line.startsWith(">")) {
      if (para.length || list) flush();
      quote.push(line.replace(/^>\s?/, ""));
    } else {
      if (list || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return out.join("");
}

export function isHtml(source: string) {
  return /^\s*</.test(source);
}

/** Safe HTML for an article body, whichever format it was saved in. */
export function toArticleHtml(body: string[]): string {
  const source = body.join("\n\n");
  return sanitizeArticleHtml(isHtml(source) ? source : markdownToHtml(source));
}

/** Split article HTML around product boxes so the page can render live product cards there. */
export function splitProducts(html: string): ({ html: string } | { product: string })[] {
  const parts: ({ html: string } | { product: string })[] = [];
  let last = 0;
  for (const m of html.matchAll(/<div data-product="([a-z0-9-]+)">[\s\S]*?<\/div>/g)) {
    if (m.index! > last) parts.push({ html: html.slice(last, m.index) });
    parts.push({ product: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < html.length) parts.push({ html: html.slice(last) });
  return parts;
}
