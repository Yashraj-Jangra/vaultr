// Exact match with the website's design system
// Source: src/app/globals.css + tailwind neutral scale (dark mode)

export const colors = {
  // Backgrounds — matches site's #09090b/neutral-950
  bg: "#09090b",
  surface: "#111111",      // --surface, neutral-900/20
  surface2: "#0d0d0d",     // form inputs / inset surface
  surface3: "#18181b",     // neutral-900 hover state
  surfaceCard: "rgba(10, 10, 10, 0.8)", // glassmorphic card

  // Borders — matches site's --border: #1a1a1a
  border: "#1f1f1f",
  borderHover: "#333",
  borderSubtle: "#141414",

  // Text — matches site's neutral scale
  text: "#f4f4f5",         // neutral-100/fg
  textMuted: "#a3a3a3",    // neutral-400
  textDim: "#737373",      // neutral-500
  textFaint: "#525252",    // neutral-600

  // Accent — clean white from design system
  accent: "#ffffff",       // white
  accentBg: "rgba(255, 255, 255, 0.08)",
  accentBorder: "rgba(255, 255, 255, 0.15)",
  accentGlow: "rgba(255, 255, 255, 0.12)",

  // Status
  success: "#10b981",      // emerald-500
  successBg: "rgba(16, 185, 129, 0.12)",
  successBorder: "rgba(16, 185, 129, 0.25)",

  warning: "#fbbf24",      // amber-400
  warningBg: "rgba(251, 191, 36, 0.12)",

  danger: "#f87171",       // red-400
  dangerBg: "rgba(239, 68, 68, 0.1)",
  dangerBorder: "rgba(185, 28, 28, 0.4)",

  // Card badge colors
  cardBlue: "#38bdf8",     // sky-400
  cardGreen: "#34d399",    // emerald-400
  cardAmber: "#fbbf24",    // amber-400
  cardPurple: "#ffffff",   // white
  cardIndigo: "#818cf8",   // indigo-400

  // Template meta colors
  violet: "#ffffff",       // white
  emerald: "#059669",      // emerald-600
  amber: "#d97706",        // amber-600

  // Neutral scale (exact Tailwind mapping)
  neutral100: "#f5f5f5",
  neutral200: "#e5e5e5",
  neutral300: "#d4d4d4",
  neutral400: "#a3a3a3",
  neutral500: "#737373",
  neutral600: "#525252",
  neutral700: "#404040",
  neutral800: "#262626",
  neutral900: "#171717",
  neutral950: "#0a0a0a",
};

// Template metadata — matches TEMPLATE_META from web
export const TEMPLATE_COLORS: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  login: {
    icon: colors.accent,
    bg: colors.accentBg,
    border: colors.accentBorder,
    text: colors.accent,
  },
  card: {
    icon: colors.cardBlue,
    bg: "rgba(56, 189, 248, 0.1)",
    border: "rgba(56, 189, 248, 0.2)",
    text: colors.cardBlue,
  },
  note: {
    icon: colors.warning,
    bg: colors.warningBg,
    border: "rgba(251, 191, 36, 0.2)",
    text: colors.warning,
  },
  address: {
    icon: colors.success,
    bg: colors.successBg,
    border: colors.successBorder,
    text: colors.success,
  },
  profile: {
    icon: colors.cardIndigo,
    bg: "rgba(129, 140, 248, 0.1)",
    border: "rgba(129, 140, 248, 0.2)",
    text: colors.cardIndigo,
  },
};
