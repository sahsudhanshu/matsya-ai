/**
 * App-wide constants and API configuration.
 * Set NEXT_PUBLIC_API_URL in .env.local to point to your deployed API Gateway.
 *
 * Set NEXT_PUBLIC_AGENT_URL for the Python agent (LangGraph chatbot).
 * Set in .env.local for local development.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/** Agent (Python FastAPI) base URL - used for chat routes */
export const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_URL;

/** Whether the LangGraph agent is available */
export const IS_AGENT_CONFIGURED = Boolean(
  AGENT_BASE_URL && AGENT_BASE_URL.trim().length > 0,
);

/** API endpoint paths */
export const ENDPOINTS = {
  verifyToken: "/auth/verify",
  presignedUrl: "/images/presigned-url",
  analyzeImage: (imageId: string) => `/images/${imageId}/analyze`,
  getImages: "/images",
  getMapData: "/map",
  sendChat: "/chat",
  getChatHistory: "/chat",
  getAnalytics: "/analytics",
  getUserProfile: "/user/profile",
  updateUserProfile: "/user/profile",
  exportUserData: "/user/export",
  deleteUserAccount: "/user/account",
  getPublicProfile: (slug: string) => `/user/public/${slug}`,
} as const;

/** ML Model API base URL for resolving static asset URLs (crop images, grad-cam, etc.) */
export const ML_BASE_URL = process.env.NEXT_PUBLIC_ML_BASE_URL;

/** Resolve ML API relative URL to absolute URL */
export function resolveMLUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${ML_BASE_URL}${path}`;
}

/** App metadata */
export const APP_NAME = "MatsyaAI";
export const APP_TAGLINE = "AI-Powered Fisherman's Assistant";

/** Supported Indian languages */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "ml", label: "മലയാളം (Malayalam)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "or", label: "ଓଡ଼ିଆ (Odia)" },
] as const;

/** Common fish species for filters */
export const FISH_SPECIES = [
  "Pomfret",
  "Indian Mackerel",
  "Kingfish",
  "Tuna",
  "Seer Fish",
  "Hilsa",
  "Sardine",
  "Rohu",
  "Catla",
  "Barramundi",
] as const;
