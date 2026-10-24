"use client";

import { companyWhatsApp } from "@/lib/company";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { formatPrice, products } from "@/lib/products";
import { MessageCircle, Send, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import { useRegion } from "@/lib/region-context";

type Msg = { from: "bot" | "you"; text: string; product?: string; quote?: boolean };

const starter: Msg[] = [
  {
    from: "you",
    text: "I need 50 brass compasses with my company logo.",
  },
  {
    from: "bot",
    text: "Great — I can help you with that. This is a B2B / custom order. Here is a starting piece, ready for your logo.",
    product: "antique-brass-nautical-compass",
    quote: true,
  },
];

function reply(input: string): Msg[] {
  const q = input.toLowerCase();
  if (q.includes("50") || q.includes("wholesale") || q.includes("bulk") || q.includes("b2b") || q.includes("logo")) {
    return [
      {
        from: "bot",
        text: "For 50 brass compasses with a company logo we typically quote from $18/pc, MOQ 50, 12–18 day production.",
        product: "antique-brass-nautical-compass",
        quote: true,
      },
    ];
  }
  if (q.includes("ship") || q.includes("delivery")) {
    return [
      {
        from: "bot",
        text: "Retail orders ship in 5–7 business days. Wholesale lots go by air or sea with documents.",
      },
    ];
  }
  return [
    {
      from: "bot",
      text: "I can help with compasses, telescopes, décor or a B2B quote. Try “I need 50 brass compasses with my company logo.”",
    },
  ];
}


export function ChatWidget() {
  const { priceFor } = useRegion();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(starter);

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

  function send() {
    const value = text.trim();
    if (!value) return;
    setMsgs((m) => [...m, { from: "you", text: value }, ...reply(value)]);
    setText("");
  }

  return (
    <>
      <div className="fixed bottom-[env(safe-area-inset-bottom)] right-3 z-30 flex items-center gap-2 sm:right-6">
        <a
          href={companyWhatsApp}
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
      </div>

      {open && (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex h-[min(560px,calc(100dvh-var(--site-nav)-2rem))] w-auto max-w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[min(100%-1.5rem,380px)]">
          <div className="flex items-center justify-between bg-[#0B1D36] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-medium">AI Shipping Assistant</p>
              <p className="text-[11px] text-[#C9A84C]">Online · Average reply 30 sec</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#F4F1EA] p-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    m.from === "you"
                      ? "rounded-br-sm bg-[#0B1D36] text-white"
                      : "rounded-bl-sm bg-white text-navy-800 shadow-sm"
                  }`}
                >
                  {m.text}
                  {m.product && productMap[m.product] && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-[#eee7db] bg-[#FAF7F2]">
                      <div className="flex gap-2 p-2">
                        <div className="relative h-14 w-14 overflow-hidden rounded-lg">
                          <Image src={productMap[m.product].image} alt="" fill className="object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-navy-900">{productMap[m.product].name}</p>
                          <p className="text-[11px] text-navy-600">
                            {formatPrice(priceFor(productMap[m.product]))} · Custom Logo
                          </p>
                          <Link href={`/product/${m.product}`} className="text-[11px] text-[#8C6E28]">
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
            ))}
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
