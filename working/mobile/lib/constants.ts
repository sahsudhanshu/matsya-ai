// ── Color Palette (Dark Mode SaaS) ────────────────────────────────────────────
export const COLORS = {
  // Primary ocean blue
  primary: "#1e40af",
  primaryLight: "#3b82f6",
  primaryDark: "#0f3460",

  // Secondary forest green
  secondary: "#047857",
  secondaryLight: "#10b981",

  // Accent warm gold
  accent: "#d97706",
  accentLight: "#f59e0b",

  // Backgrounds
  bgDark: "#0f172a",
  bgCard: "#1e293b",
  bgSurface: "#334155",

  // Text
  textPrimary: "#f8fafc",
  textSecondary: "#e2e8f0",
  textMuted: "#94a3b8",
  textSubtle: "#64748b",

  // Borders
  border: "#334155",
  borderLight: "#475569",

  // Status colors
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  danger: "#ef4444",
  info: "#3b82f6",

  // Quality grades
  premium: "#10b981",
  standard: "#f59e0b",
  low: "#ef4444",

  // Common colors
  white: "#ffffff",
  black: "#000000",

  // Transparent
  overlay: "rgba(15, 23, 42, 0.8)",
  cardOverlay: "rgba(30, 41, 59, 0.95)",
} as const;

// ── Typography ─────────────────────────────────────────────────────────────────
export const FONTS = {
  sizes: {
    xs: 10,
    sm: 12,
    base: 13,
    md: 15,
    lg: 17,
    xl: 20,
    "2xl": 22,
    "3xl": 26,
    "4xl": 30,
  },
  weights: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
};

// ── Spacing (8px Grid System) ──────────────────────────────────────────────────
// All spacing values follow an 8px grid for consistency with web
export const SPACING = {
  xs: 4, // 0.5 × 8px - Minimal spacing
  sm: 8, // 1 × 8px - Small spacing
  md: 16, // 2 × 8px - Medium spacing (default)
  lg: 24, // 3 × 8px - Large spacing
  xl: 32, // 4 × 8px - Extra large spacing
  "2xl": 48, // 6 × 8px - 2X large spacing
  "3xl": 64, // 8 × 8px - 3X large spacing
  "4xl": 96, // 12 × 8px - 4X large spacing
  full: 9999, // Full width/height
} as const;

// ── Border Radius ──────────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  full: 999,
};

// ── API Configuration ──────────────────────────────────────────────────────────
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
export const AGENT_BASE_URL = process.env.EXPO_PUBLIC_AGENT_URL || "";
export const IS_AGENT_CONFIGURED = true;
export const IS_DEMO_MODE = !API_BASE_URL;
export const DEMO_JWT = "demo_token_ocean_ai_bharat";

export const ENDPOINTS = {
  presignedUrl: "/images/presigned-url",
  analyzeImage: (id: string) => `/images/${id}/analyze`,
  getImages: "/images",
  getMapData: "/map",
  sendChat: "/chat",
  getChatHistory: "/chat/history",
  getAnalytics: "/analytics",
  saveWeightEstimate: "/weight-estimates",
  saveOfflineAnalysis: "/offline-analyses",  // legacy - kept for reference
  syncOfflineSessionPrepare: "/sync/offline-session/prepare",
  syncOfflineSessionCommit: "/sync/offline-session/commit",
};

// ── App Config ───────────────────────────────────────────────────────────────
export const APP_NAME = "Matsya AI";
export const APP_TAGLINE = "AI for Bharat Fishermen";

// Telegram Bot Configuration
export const TELEGRAM_BOT_USERNAME =
  process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || "Matsya AICompanionBot";

export const FISH_SPECIES = [
  "All Species",
  "Indian Pomfret",
  "Indian Mackerel",
  "Kingfish",
  "Yellowfin Tuna",
  "Seer Fish",
  "Hilsa Shad",
];

export const INDIAN_LANGUAGES = [
  "English",
  "Hindi",
  "Marathi",
  "Gujarati",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Odia",
];

// Default map center - Indian west coast
export const DEFAULT_MAP_REGION = {
  latitude: 16.0,
  longitude: 76.0,
  latitudeDelta: 25,
  longitudeDelta: 25,
};
