"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

const RADIUS = 21;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Floating scroll button above the chat buttons. The ring shows how far down the page you are;
 * in the top half it jumps to the bottom, past halfway it returns to the top.
 */
export function ScrollProgressButton() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setVisible(max > 200 && window.scrollY > 200);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const goingUp = progress >= 0.5;

  function jump() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: goingUp ? 0 : document.documentElement.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={jump}
      aria-label={goingUp ? "Scroll to top" : "Scroll to bottom"}
      title={goingUp ? "Scroll to top" : "Scroll to bottom"}
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] right-3 z-30 grid h-12 w-12 place-items-center rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition duration-300 hover:scale-105 sm:right-6 ${
        visible ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg className="absolute inset-0 h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="#031D38" strokeOpacity="0.12" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          stroke="#C9A84C"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <ArrowUp className={`relative h-5 w-5 text-[#031D38] transition-transform duration-300 ${goingUp ? "" : "rotate-180"}`} />
    </button>
  );
}
