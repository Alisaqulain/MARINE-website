"use client";

import { whatsAppChat } from "@/lib/company";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { formatPrice, products } from "@/lib/products";
import { MessageCircle, Send, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import { useRegion } from "@/lib/region-context";
import { aiSessionId } from "@/lib/ai/session-client";
import { ScrollProgressButton } from "@/components/ScrollProgressButton";

type Msg = {
  from: "bot" | "you";
  text: string;
  product?: string;
  quote?: boolean;
  price?: number;
  productName?: string;
};

const starter: Msg[] = [
  {
    from: "bot",
    text: "Ask me about a product, its current price, stock, shipping, or returns. I only use the live catalogue and approved policies.",
  },
];


const CHAT_SESSION_KEY = "marina-chat-session";
const CHAT_THEME_KEY = "marina-chat-theme";
/** Chat background options (the visitor's choice is remembered on this device). */
const CHAT_THEMES = [
  { id: "cream", label: "Cream", bg: "#F4F1EA" },
  { id: "white", label: "White", bg: "#FFFFFF" },
  { id: "blue", label: "Blue", bg: "#E8F0FA" },
  { id: "green", label: "Green", bg: "#E6F4EA" },
] as const;
const CHAT_MSGS_KEY = "marina-chat-messages";

/** One chat id per device, so Marina AI remembers the conversation across pages, reloads and visits. */
function chatSessionId(): string {
  try {
    const existing = localStorage.getItem(CHAT_SESSION_KEY);
    if (existing) return existing;
    const created = aiSessionId();
    localStorage.setItem(CHAT_SESSION_KEY, created);
    return created;
  } catch {
    return aiSessionId();
  }
}

export function ChatWidget() {
  const { priceFor } = useRegion();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(starter);
  const listRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<string>("cream");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_THEME_KEY);
      if (saved && CHAT_THEMES.some((t) => t.id === saved)) setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);
  function pickTheme(id: string) {
    setTheme(id);
    try {
      localStorage.setItem(CHAT_THEME_KEY, id);
    } catch {
      /* ignore */
    }
  }
  const themeBg = CHAT_THEMES.find((t) => t.id === theme)?.bg ?? "#F4F1EA";

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHAT_MSGS_KEY) || "[]") as Msg[];
      if (Array.isArray(saved) && saved.length) setMsgs(saved);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CHAT_MSGS_KEY, JSON.stringify(msgs.slice(-60)));
    } catch {
      /* storage full or blocked: the chat still works */
    }
  }, [msgs, loaded]);

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.slug, p])),
    []
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const slug = (event as CustomEvent<{ product?: string }>).detail?.product;
      const piece = slug ? productMap[slug] : undefined;
      setOpen(true);
      if (piece) {
        setMsgs((current) => [
          ...current,
          {
            from: "bot",
            text: `You're looking at the ${piece.name}. I can talk materials, wholesale lots, engraving or shipping.`,
            product: piece.slug,
            quote: true,
          },
        ]);
      }
    };
    window.addEventListener("marina-chat-open", onOpen);
    return () => window.removeEventListener("marina-chat-open", onOpen);
  }, [productMap]);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, open, busy]);

  /** Removes one of your messages (and Marina's answer to it) from this chat. */
  function removeAt(index: number) {
    setMsgs((m) => m.filter((_, i) => i !== index && !(i === index + 1 && m[i]?.from === "bot")));
  }

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setMsgs((m) => [...m, { from: "you", text: value }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: chatSessionId(), message: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgs((m) => [...m, { from: "bot", text: typeof data.error === "string" ? data.error : "I could not answer just now." }]);
        return;
      }
      const products = Array.isArray(data.products) ? data.products : [];
      const first = products[0] as { slug?: string; name?: string; price?: number } | undefined;
      setMsgs((m) => [
        ...m,
        {
          from: "bot",
          text: String(data.reply || "I don't have an approved answer for that."),
          product: first?.slug,
          productName: first?.name,
          price: typeof first?.price === "number" ? first.price : undefined,
          quote: Boolean(data.quote),
        },
      ]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "I could not reach the catalogue just now." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-[env(safe-area-inset-bottom)] right-3 z-30 flex items-center gap-2 sm:right-6">
        <a
          href={whatsAppChat("Hello Marina Muse, I would like some help with a product or order.")}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          title="Chat on WhatsApp"
          className="grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition hover:scale-105 hover:bg-[#1ebe5b]"
        >
          <WhatsAppIcon className="h-6 w-6" />
        </a>
        <button
          onClick={() => setOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-[#C9A84C]/50 bg-[#031D38] px-5 text-sm text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition hover:scale-105 hover:bg-navy-800"
          aria-label="Ask Marina"
        >
          <MessageCircle className="h-5 w-5 text-[#C9A84C]" />
          <span>Ask Marina</span>
        </button>
        <ScrollProgressButton />
      </div>

      {open && (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex h-[min(560px,calc(100dvh-var(--site-nav)-2rem))] w-auto max-w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[min(100%-1.5rem,380px)]">
          <div className="flex items-center justify-between bg-[#0B1D36] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-medium">Marina AI Assistant</p>
              <p className="text-[11px] text-[#C9A84C]">Online · Usually replies in a few seconds</p>
            </div>
            <div className="ml-auto mr-3 flex items-center gap-1.5" aria-label="Chat background">
              {CHAT_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={`${t.label} background`}
                  aria-label={`${t.label} background`}
                  onClick={() => pickTheme(t.id)}
                  className={`h-4 w-4 rounded-full border ${theme === t.id ? "border-[#C9A84C] ring-2 ring-[#C9A84C]" : "border-white/60"}`}
                  style={{ background: t.bg }}
                />
              ))}
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto scroll-smooth p-4" style={{ background: themeBg }}>
            {msgs.map((m, i) => (
              <div key={i} className={`group flex flex-col ${m.from === "you" ? "items-end" : "items-start"}`}>
                <div className={`flex w-full ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    m.from === "you"
                      ? "rounded-br-sm bg-[#0B1D36] text-white"
                      : "rounded-bl-sm bg-white text-navy-800 shadow-sm"
                  }`}
                >
                  {m.text.split(/(https?:\/\/[^\s]+)/g).map((part, k) =>
                    /^https?:\/\//.test(part) ? (
                      <a
                        key={k}
                        href={part}
                        onClick={() => setOpen(false)}
                        className="break-all text-[#8C6E28] underline"
                      >
                        {part.replace(/^https?:\/\/(www\.)?marinamuseinternational\.com/, "") || part}
                      </a>
                    ) : (
                      <span key={k}>{part}</span>
                    )
                  )}
                  {m.product && (productMap[m.product] || m.productName) && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-[#eee7db] bg-[#FAF7F2]">
                      <div className="flex gap-2 p-2">
                        {productMap[m.product]?.image ? (
                          <div className="relative h-14 w-14 overflow-hidden rounded-lg">
                            <Image src={productMap[m.product].image} alt="" fill className="object-cover" />
                          </div>
                        ) : null}
                        <div>
                          <p className="text-xs font-medium text-navy-900">{m.productName || productMap[m.product]?.name}</p>
                          <p className="text-[11px] text-navy-600">
                            {formatPrice(m.price ?? (productMap[m.product] ? priceFor(productMap[m.product]) : 0))}
                          </p>
                          <Link href={`/product/${m.product}`} onClick={() => setOpen(false)} className="text-[11px] text-[#8C6E28]">
                            View details
                          </Link>
                        </div>
                      </div>
                      {m.quote ? (
                        <WholesaleNavLink
                          callbackUrl="/wholesale/quote"
                          className="block bg-[#0B1D36] py-2 text-center text-[11px] uppercase tracking-[0.14em] text-white"
                        >
                          Proceed to Request Quote
                        </WholesaleNavLink>
                      ) : null}
                    </div>
                  )}
                </div>
                </div>
                {m.from === "you" ? (
                  <div className="mt-0.5 flex gap-2 text-[10px] text-navy-500 opacity-70 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setText(m.text);
                        removeAt(i);
                      }}
                      className="underline"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => removeAt(i)} className="underline">
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <p className="text-[12px] italic text-navy-500">Marina is typing…</p> : null}
          </div>
          <form
            className="flex items-center gap-2 border-t border-[#eee7db] bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…"
              className="flex-1 rounded-full bg-[#F4F1EA] px-4 py-2 text-sm outline-none"
            />
            <button type="submit" className="rounded-full bg-[#C9A84C] p-2 text-navy-950" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
