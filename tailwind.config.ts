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
          300: "rgb(var(--brand-400) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-600) / <alpha-value>)",
          800: "rgb(var(--brand-950) / <alpha-value>)",
          900: "rgb(var(--brand-950) / <alpha-value>)",
          950: "rgb(var(--brand-950) / <alpha-value>)",
        },
        surface: {
          DEFAULT:  "var(--color-surface)",
          card:     "var(--color-surface-card)",
          elevated: "var(--color-surface-elevated)",
          border:   "var(--color-surface-border)",
          muted:    "var(--color-surface-muted)",
        },
        fg: {
          DEFAULT: "var(--color-fg)",
          muted:   "var(--color-fg-muted)",
          subtle:  "var(--color-fg-subtle)",
        },
        success: { DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)", muted: "var(--color-success-muted)" },
        warning: { DEFAULT: "rgb(var(--warning-rgb) / <alpha-value>)", muted: "var(--color-warning-muted)" },
        danger:  { DEFAULT: "rgb(var(--danger-rgb) / <alpha-value>)", muted: "var(--color-danger-muted)" },
      },
      boxShadow: {
        "glow-brand": "var(--shadow-glow-brand)",
        "glow-sm":    "var(--shadow-glow-sm)",
        "card":       "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
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
        pulseBrand: {
          "0%,100%": { boxShadow: "var(--shadow-pulse-brand-low)" },
          "50%": { boxShadow: "var(--shadow-pulse-brand-high)" },
        },
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
