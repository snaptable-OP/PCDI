import type { Config } from "tailwindcss";

const config: Config = {
  /* Opt-in only: add class "dark" on <html> — OS dark mode no longer overrides brand tokens. */
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      colors: {
        sidebar: "var(--sidebar-bg)",
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          elevated: "var(--surface-elevated)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          muted: "var(--accent-muted)",
          foreground: "var(--accent-foreground)",
          hover: "var(--accent-hover)",
          active: "var(--accent-active)",
          tint: "var(--accent-tint)",
          "tint-border": "var(--accent-tint-border)",
        },
        nav: {
          DEFAULT: "var(--nav-text)",
          hover: "var(--nav-hover-text)",
        },
        heading: "var(--heading-foreground)",
        foreground: {
          DEFAULT: "var(--foreground)",
          muted: "var(--muted-foreground)",
          emphasis: "var(--emphasis-foreground)",
        },
        link: {
          DEFAULT: "var(--link)",
          hover: "var(--link-hover)",
        },
        mineral: {
          "deep-shale": "#4a6a7a",
          "slate-blue": "#6b8ea0",
          "weathered-slate": "#8aacbc",
          "quarry-mist": "#a8c4d0",
          "bluestone-wash": "#d0e0e8",
        },
        quarry: {
          "deep-moss": "#3a4d36",
          sage: "#576b50",
          lichen: "#7fa65a",
          fern: "#9dbf7a",
          "pale-lichen": "#c2d8a0",
        },
        water: {
          "deep-pool": "#3d6868",
          "quarry-pool": "#5a8a8a",
          still: "#78a8a8",
          "mineral-spring": "#96c0be",
          "chalky-wash": "#b8d8d4",
        },
        earth: {
          "kiln-brick": "#8b4a2a",
          terracotta: "#c87850",
          "baked-clay": "#d89878",
          sunbaked: "#e8b8a0",
          "pale-terra": "#f0d4c4",
        },
        silt: {
          "river-bed": "#6b5440",
          mudstone: "#a08060",
          alluvial: "#b89878",
          silt: "#c8b090",
          "dry-creek": "#ddd0b8",
        },
        oxide: {
          "raw-iron": "#5c3a1e",
          "iron-oxide": "#8b5a2b",
          ochre: "#a87840",
          "amber-ore": "#c89858",
          "pale-ochre": "#d8b878",
        },
        shale: {
          "quarry-shadow": "#4a5a60",
          "wet-slate": "#687e88",
          "dry-slate": "#88a0ac",
          "shale-dust": "#a0b8c0",
          "fossil-grey": "#c0d0d8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
