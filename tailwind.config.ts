import type { Config } from "tailwindcss";

/**
 * Les valeurs concrètes vivent dans `app/globals.css` (variables CSS).
 * Ce fichier ne fait que les exposer à Tailwind, pour qu'un ajustement de charte
 * se fasse à un seul endroit.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          strong: "hsl(var(--surface-strong))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        interactive: {
          DEFAULT: "hsl(var(--interactive))",
          hover: "hsl(var(--interactive-hover))",
          foreground: "hsl(var(--interactive-foreground))",
          soft: "hsl(var(--interactive-soft))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          active: "hsl(var(--sidebar-active))",
          border: "hsl(var(--sidebar-border))",
          mark: "hsl(var(--sidebar-mark))",
          "mark-foreground": "hsl(var(--sidebar-mark-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
        },
        status: {
          draft: "hsl(var(--status-draft))",
          "draft-bg": "hsl(var(--status-draft-bg))",
          sent: "hsl(var(--status-sent))",
          "sent-bg": "hsl(var(--status-sent-bg))",
          partial: "hsl(var(--status-partial))",
          "partial-bg": "hsl(var(--status-partial-bg))",
          paid: "hsl(var(--status-paid))",
          "paid-bg": "hsl(var(--status-paid-bg))",
          overdue: "hsl(var(--status-overdue))",
          "overdue-bg": "hsl(var(--status-overdue-bg))",
          cancelled: "hsl(var(--status-cancelled))",
          "cancelled-bg": "hsl(var(--status-cancelled-bg))",
        },
      },
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 6px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "overlay-in": "overlay-in 0.18s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
