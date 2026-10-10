import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./auth.config.ts",
    "./auth.ts",
    "./middleware.ts",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070F1A",
          900: "#0B1D36",
          850: "#0E2444",
          800: "#12243F",
          700: "#1A3358",
          600: "#23456F",
          500: "#3B5A80",
        },
        gold: {
          50: "#FBF6E8",
          100: "#F3E6C4",
          200: "#E8D5A3",
          300: "#E0C87A",
          400: "#D4AF37",
          500: "#C9A84C",
          600: "#B8943E",
          700: "#8C6E28",
        },
        cream: {
          50: "#FFFEFB",
          100: "#FAF8F4",
          200: "#F7F3EC",
          300: "#EDE6D9",
        },
      },
      fontFamily: {
        serif: [
          "ABCDiatype",
          "-apple-system",
          "Helvetica Neue",
          "Droid Sans",
          "Arial",
          "sans-serif",
        ],
        display: [
          "ABCDiatype",
          "-apple-system",
          "Helvetica Neue",
          "Droid Sans",
          "Arial",
          "sans-serif",
        ],
        sans: [
          "ABCDiatype",
          "-apple-system",
          "Helvetica Neue",
          "Droid Sans",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        gold: "0 10px 40px rgba(201, 168, 76, 0.18)",
        soft: "0 18px 50px rgba(11, 29, 54, 0.08)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        storyRing: {
          "0%": { transform: "scale(1)", opacity: "0.65" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        storyPulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.07)" },
        },
      },
      animation: {
        marquee: "marquee 38s linear infinite",
        fadeIn: "fadeIn 0.6s ease",
        "story-ring": "storyRing 2s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "story-pulse": "storyPulse 2s ease-in-out infinite",
      },
      backgroundImage: {
        "navy-texture":
          "radial-gradient(circle at 20% 20%, rgba(201,168,76,0.08), transparent 28%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.04), transparent 24%), linear-gradient(180deg, #0B1D36 0%, #070F1A 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
