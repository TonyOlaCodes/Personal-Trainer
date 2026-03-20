import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["monospace"],
      },
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#e0eaff",
          200: "#c7d7fd",
          300: "#a5bafc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        surface: {
          DEFAULT:  "#0a0a0f",
          card:     "#111118",
          elevated: "#16161f",
          border:   "#1e1e2e",
          muted:    "#1a1a26",
        },
        fg: {
          DEFAULT: "#f8f8fc",
          muted:   "#8888a8",
          subtle:  "#4a4a6a",
        },
        success: { DEFAULT: "#22d3a0", muted: "#0f3d2e" },
        warning: { DEFAULT: "#f59e0b", muted: "#3d2e0f" },
        danger:  { DEFAULT: "#f43f5e", muted: "#3d0f1a" },
      },
      boxShadow: {
        "glow-brand": "0 0 20px rgba(99,102,241,0.35)",
        "glow-sm":    "0 0 10px rgba(99,102,241,0.2)",
        "card":       "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover": "0 4px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.3)",
        "modal":      "0 25px 50px rgba(0,0,0,0.8)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease forwards",
        "slide-up":   "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "pulse-brand": "pulseBrand 2s ease-in-out infinite",
        "shimmer":    "shimmer 1.5s linear infinite",
        "spin-slow":  "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn:     { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:    { "0%": { opacity: "0", transform: "translateY(20px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseBrand: { "0%,100%": { boxShadow: "0 0 15px rgba(99,102,241,0.3)" }, "50%": { boxShadow: "0 0 30px rgba(99,102,241,0.6)" } },
        shimmer:    { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      spacing: {
        "18":  "4.5rem",
        "88":  "22rem",
        "128": "32rem",
      },
    },
  },
  plugins: [],
};

export default config;
