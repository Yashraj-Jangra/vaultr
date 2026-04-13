// Theme type definitions and built-in theme catalog

export interface ThemeColors {
  bg: string;
  fg: string;
  fgMuted: string;
  surface: string;
  border: string;
  borderHover: string;
  accent: string;
  danger: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  colors: ThemeColors;
  radius: number;       // 0–24 (px applied as border-radius scale)
  font: string;         // Google Font name, e.g. "Inter"
  mode: "dark" | "light";
  builtIn: boolean;     // Cannot be deleted
  published: boolean;   // Visible to users in settings
  createdAt?: string;
}

// Google Font options available in the theme builder
export const FONT_OPTIONS = [
  "Inter",
  "Outfit",
  "DM Sans",
  "Roboto",
  "Poppins",
  "JetBrains Mono",
  "Space Grotesk",
  "Sora",
  "Geist",
  "Manrope",
  "IBM Plex Mono",
  "Fira Code",
] as const;

// Built-in themes — these are seeded into Firestore on first admin visit if absent
export const BUILT_IN_THEMES: ThemeConfig[] = [
  {
    id: "dark",
    name: "Default Dark",
    mode: "dark",
    builtIn: true,
    published: true,
    radius: 6,
    font: "Inter",
    colors: {
      bg:          "#0a0a0a",
      fg:          "#ededed",
      fgMuted:     "#888888",
      surface:     "#111111",
      border:      "#1a1a1a",
      borderHover: "#333333",
      accent:      "#ffffff",
      danger:      "#ef4444",
    },
  },
  {
    id: "light",
    name: "Default Light",
    mode: "light",
    builtIn: true,
    published: true,
    radius: 6,
    font: "Inter",
    colors: {
      bg:          "#f5f5f5",
      fg:          "#111111",
      fgMuted:     "#666666",
      surface:     "#ffffff",
      border:      "#e5e5e5",
      borderHover: "#d4d4d4",
      accent:      "#111111",
      danger:      "#dc2626",
    },
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    mode: "dark",
    builtIn: false,
    published: false,
    radius: 8,
    font: "Outfit",
    colors: {
      bg:          "#09090f",
      fg:          "#e2e8f0",
      fgMuted:     "#64748b",
      surface:     "#0f0f1a",
      border:      "#1e1e3a",
      borderHover: "#2d2d5a",
      accent:      "#818cf8",
      danger:      "#f87171",
    },
  },
  {
    id: "forest",
    name: "Forest Green",
    mode: "dark",
    builtIn: false,
    published: false,
    radius: 6,
    font: "DM Sans",
    colors: {
      bg:          "#0a0f0a",
      fg:          "#d1fae5",
      fgMuted:     "#6ee7b7",
      surface:     "#0f180f",
      border:      "#1a2e1a",
      borderHover: "#2d4a2d",
      accent:      "#34d399",
      danger:      "#f87171",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    mode: "dark",
    builtIn: false,
    published: false,
    radius: 10,
    font: "Space Grotesk",
    colors: {
      bg:          "#040d18",
      fg:          "#e0f2fe",
      fgMuted:     "#7dd3fc",
      surface:     "#071e33",
      border:      "#0c3058",
      borderHover: "#1a4a7a",
      accent:      "#38bdf8",
      danger:      "#fb923c",
    },
  },
  {
    id: "warm-sand",
    name: "Warm Sand",
    mode: "light",
    builtIn: false,
    published: false,
    radius: 8,
    font: "Poppins",
    colors: {
      bg:          "#faf7f2",
      fg:          "#292524",
      fgMuted:     "#78716c",
      surface:     "#ffffff",
      border:      "#e7e5e4",
      borderHover: "#d6d3d1",
      accent:      "#a16207",
      danger:      "#dc2626",
    },
  },
  {
    id: "arctic",
    name: "Arctic",
    mode: "light",
    builtIn: false,
    published: false,
    radius: 12,
    font: "Sora",
    colors: {
      bg:          "#f0f9ff",
      fg:          "#0c1a2e",
      fgMuted:     "#475569",
      surface:     "#ffffff",
      border:      "#e2eaf5",
      borderHover: "#cbd5e1",
      accent:      "#0369a1",
      danger:      "#dc2626",
    },
  },
];

/** Apply a ThemeConfig as CSS custom properties on the document root */
export function applyTheme(theme: ThemeConfig): void {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.style.setProperty("--bg",           theme.colors.bg);
  r.style.setProperty("--fg",           theme.colors.fg);
  r.style.setProperty("--fg-muted",     theme.colors.fgMuted);
  r.style.setProperty("--surface",      theme.colors.surface);
  r.style.setProperty("--border",       theme.colors.border);
  r.style.setProperty("--border-hover", theme.colors.borderHover);
  r.style.setProperty("--accent",       theme.colors.accent);
  r.style.setProperty("--danger",       theme.colors.danger);
  r.style.setProperty("--radius",       `${theme.radius}px`);
  // Font is loaded lazily; just set the variable
  r.style.setProperty("--font-theme",   `'${theme.font}', var(--font-geist-sans), sans-serif`);
  // Apply color-scheme for browser chrome (scrollbars, inputs, etc.)
  r.style.setProperty("color-scheme",   theme.mode);

  if (theme.mode === "light") {
    r.classList.add("theme-light");
  } else {
    r.classList.remove("theme-light");
  }
}

