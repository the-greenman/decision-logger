import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Arial", "sans-serif"],
        mono: ['"IBM Plex Mono"', '"Courier New"', "monospace"],
      },
      colors: {
        // Surfaces
        base:        "var(--color-base)",
        surface:     "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        overlay:     "var(--color-overlay)",

        // Borders
        border:          "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        "border-locked": "var(--color-border-locked)",

        // Text
        "text-primary":   "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted":     "var(--color-text-muted)",
        "text-locked":    "var(--color-text-locked)",

        // Brand absolute
        black: "var(--color-black)",
        white: "var(--color-white)",

        // Semantic
        settled:         "var(--color-settled)",
        "settled-dim":   "var(--color-settled-dim)",
        accent:          "var(--color-accent)",
        "accent-dim":    "var(--color-accent-dim)",
        caution:         "var(--color-caution)",
        "caution-dim":   "var(--color-caution-dim)",
        danger:          "var(--color-danger)",
        "danger-dim":    "var(--color-danger-dim)",

        // Tag categories
        "tag-topic":      "var(--color-tag-topic)",
        "tag-topic-bg":   "var(--color-tag-topic-bg)",
        "tag-team":       "var(--color-tag-team)",
        "tag-team-bg":    "var(--color-tag-team-bg)",
        "tag-project":    "var(--color-tag-project)",
        "tag-project-bg": "var(--color-tag-project-bg)",

        // Candidate states
        "candidate-new":       "var(--color-candidate-new)",
        "candidate-dismissed": "var(--color-candidate-dismissed)",
      },
      fontSize: {
        // μDemocracy type scale — letter-spacing creates editorial feel
        "xs":   ["11px", { lineHeight: "1.4", letterSpacing: "0.1em" }],
        "sm":   ["13px", { lineHeight: "1.6" }],
        "base": ["16px", { lineHeight: "1.6" }],
        "md":   ["20px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "lg":   ["28px", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "xl":   ["42px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "2xl":  ["64px", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
        "3xl":  ["96px", { lineHeight: "1.1", letterSpacing: "-0.03em" }],

        // Density modes (retained)
        "display-title": ["2rem",     { lineHeight: "1.2",  fontWeight: "700" }],
        "display-field": ["1.375rem", { lineHeight: "1.5" }],
        "display-label": ["0.9375rem",{ lineHeight: "1.4",  fontWeight: "700" }],
        "display-meta":  ["0.875rem", { lineHeight: "1.4" }],
        "fac-title":     ["1.75rem",  { lineHeight: "1.2",  fontWeight: "700", letterSpacing: "-0.015em" }],
        "fac-field":     ["0.9375rem",{ lineHeight: "1.5" }],
        "fac-label":     ["0.75rem",  { lineHeight: "1.4",  fontWeight: "700", letterSpacing: "0.05em" }],
        "fac-meta":      ["0.75rem",  { lineHeight: "1.4" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      borderRadius: {
        // Sharp everywhere — no radius in this design system
        none:    "0",
        DEFAULT: "0",
        sm:      "0",
        md:      "0",
        lg:      "0",
        xl:      "0",
        "2xl":   "0",
        full:    "0",
        card:    "0",
        pill:    "0",
        badge:   "0",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.4" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        "field-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-slow": "pulse 2s ease-in-out infinite",
        "field-in":   "field-in 0.2s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
