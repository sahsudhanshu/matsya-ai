/**
 * API client for Mastya AI backend - React Native port of the web api-client.ts
 * Uses AsyncStorage for token management. Demo mode when EXPO_PUBLIC_API_URL not set.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  API_BASE_URL,
  AGENT_BASE_URL,
  IS_AGENT_CONFIGURED,
  DEMO_JWT,
  IS_DEMO_MODE,
  ENDPOINTS,
} from "./constants";
import { handleApiError } from "./error-handler";
import {
  retryWithBackoff,
  RETRY_PRESETS,
  type RetryOptions,
} from "./retry-utils";
import type {
  FishAnalysisResult,
  ChatMessage,
  GroupAnalysis,
  UserProfile,
  PublicProfile,
  UserPreferences,
} from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  imageId: string;
  s3Path: string;
}

export interface AnalyzeImageResponse {
  imageId: string;
  analysisResult: FishAnalysisResult;
}

export interface MLApiCrop {
  bbox: number[];
  crop_url: string;
  species: {
    label: string;
    confidence: number;
    gradcam_url: string;
  };
  disease: {
    label: string;
    confidence: number;
    gradcam_url: string;
  };
  yolo_confidence: number;
}

export interface MLApiResponse {
  crops: Record<string, MLApiCrop>;
  yolo_image_url: string;
}

// ── Group-based Multi-Image Types ────────────────────────────────────────────

export interface GroupPresignedUrlResponse {
  groupId: string;
  presignedUrls: { index: number; uploadUrl: string; s3Key: string }[];
  locationMapped?: boolean;
  locationMapReason?: string;
}

export interface GroupRecord {
  groupId: string;
  userId: string;
  imageCount: number;
  s3Keys: string[];
  presignedViewUrls?: string[];
  status: "pending" | "processing" | "completed" | "partial" | "failed";
  analysisResult?: GroupAnalysis;
  latitude?: number;
  longitude?: number;
  locationMapped?: boolean;
  locationMapReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GroupListResponse {
  groups: GroupRecord[];
  lastKey?: string;
}

export interface MapMarker {
  imageId: string;
  latitude: number;
  longitude: number;
  species?: string;
  qualityGrade?: string;
  weight_g?: number;
  createdAt: string;
}

export interface MapDataResponse {
  markers: MapMarker[];
}

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: "en",
  notifications: true,
  offlineSync: true,
  units: "kg",
};

const DEFAULT_PUBLIC_PROFILE: PublicProfile = {
  slug: "profile-unavailable",
  userId: "unknown",
  name: "Anonymous Fisher",
  role: "Fisherman",
  port: "Unknown",
  isPublic: false,
  showStats: false,
  createdAt: new Date().toISOString(),
};

export type { ChatMessage } from "./types";

export interface SendChatResponse {
  chatId: string;
  response: string;
  timestamp: string;
}

export interface Conversation {
  conversationId: string;
  title: string;
  language: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface UnifiedMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  uiActions?: any;
}

export interface ImageRecord {
  imageId: string;
  userId: string;
  s3Path: string;
  status: "pending" | "processing" | "completed" | "failed";
  analysisResult?: FishAnalysisResult;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface AnalyticsResponse {
  totalImages: number;
  totalCatches: number;
  totalEarnings: number;
  avgWeight: number;
  topSpecies: string;
  weeklyTrend: { date: string; earnings: number; catches: number }[];
  speciesBreakdown: { name: string; count: number; percentage: number }[];
  qualityDistribution: { grade: string; count: number }[];
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  try {
    const token = await AsyncStorage.getItem("ocean_ai_token");
    if (!token) {
      console.warn("No token found in AsyncStorage, using demo JWT");
    }
    return token || DEMO_JWT;
  } catch (error) {
    console.error("Failed to retrieve token from AsyncStorage:", error);
    return DEMO_JWT;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    const token = await getToken();
    const url = `${API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    const headersForLog = { ...headers };
    if (headersForLog.Authorization) {
      headersForLog.Authorization = "[REDACTED]";
    }

    console.log(
      "--- Sending request to agent ---",
      JSON.stringify(
        {
          url,
          options: {
            ...options,
            headers: headersForLog,
          },
        },
        null,
        2,
      ),
    );

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let message = `API error ${res.status}`;
      try {
        const body = await res.json();
        message = body.message || body.error || message;
      } catch {
        /* ignore */
      }
      const error = new ApiError(res.status, message);
      await handleApiError(error);
      throw error; // This line won't be reached if handleApiError redirects
    }

    return res.json() as Promise<T>;
  } catch (error) {
    await handleApiError(error);
    throw error;
  }
}

/**
 * API fetch with retry logic for transient failures
 */
async function apiFetchWithRetry<T>(
  path: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = RETRY_PRESETS.STANDARD,
): Promise<T> {
  return retryWithBackoff(() => apiFetch<T>(path, options), {
    ...retryOptions,
    onRetry: (attempt, error) => {
      console.log(
        `Retrying API call to ${path} (attempt ${attempt}):`,
        error.message,
      );
    },
  });
}

/**
 * Fetch helper for the Python agent (LangGraph).
 * Same pattern as apiFetch but hits the agent URL.
 */
async function agentFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    const token = await getToken();
    const url = `${AGENT_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    const headersForLog = { ...headers };
    if (headersForLog.Authorization) {
      headersForLog.Authorization = "[REDACTED]";
    }

    let requestType = "none";
    if (options.body && typeof options.body === "string") {
      try {
        const parsed = JSON.parse(options.body);
        if (parsed.message) {
          const matches = parsed.message.match(/\[(.*?)\]/g);
          if (matches) {
            requestType = matches.join(" ");
          }
        }
      } catch (e) {}
    }

    console.log(
      "--- Sending request to agent ---",
      JSON.stringify(
        {
          url,
          requestType,
          options: {
            ...options,
            headers: headersForLog,
            body: options.body ? JSON.parse(options.body as string) : undefined,
          },
        },
        null,
        2,
      ),
    );

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let message = `Agent API error ${res.status}`;
      try {
        const body = await res.json();
        message = body.message || body.error || body.detail || message;
      } catch {
        /* ignore */
      }
      const error = new ApiError(res.status, message);
      await handleApiError(error);
      throw error;
    }

    return res.json() as Promise<T>;
  } catch (error) {
    await handleApiError(error);
    throw error;
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getPresignedUrl(
  fileName: string,
  fileType: string,
  latitude?: number,
  longitude?: number,
): Promise<PresignedUrlResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable uploads.",
    );
  }
  return apiFetch<PresignedUrlResponse>(ENDPOINTS.presignedUrl, {
    method: "POST",
    body: JSON.stringify({ fileName, fileType, latitude, longitude }),
  });
}

/**
 * Upload image to S3 via presigned URL.
 * In demo mode, simulates progress without actual upload.
 */
export function uploadToS3(
  url: string,
  fileUri: string,
  fileType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(
        new Error("No upload URL provided. Backend API may not be configured."),
      );
      return;
    }
    // Real S3 upload using React Native fetch
    fetch(fileUri)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to read file: ${r.status}`);
        }
        return r.blob();
      })
      .then((blob) =>
        fetch(url, {
          method: "PUT",
          headers: { "Content-Type": fileType },
          body: blob,
        }),
      )
      .then((res) => {
        if (res.ok) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`S3 upload failed: ${res.status}`));
        }
      })
      .catch((error) => {
        reject(new Error(`Upload error: ${error.message || "Unknown error"}`));
      });
  });
}

export async function analyzeImage(
  imageId: string,
): Promise<AnalyzeImageResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable cloud analysis.",
    );
  }
  return apiFetch<AnalyzeImageResponse>(ENDPOINTS.analyzeImage(imageId), {
    method: "POST",
  });
}

/**
 * Analyze image using ML API (returns raw ML response with crops, gradcam, etc.)
 */
export async function analyzeImageML(imageId: string): Promise<MLApiResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable ML analysis.",
    );
  }
  return apiFetch<MLApiResponse>(ENDPOINTS.analyzeImage(imageId), {
    method: "POST",
  });
}

/**
 * Convert ML API response to FishAnalysisResult (uses first/best crop)
 */
export function mlResponseToAnalysisResult(
  mlResponse: MLApiResponse,
): FishAnalysisResult {
  const crops = Object.values(mlResponse.crops);
  if (crops.length === 0) {
    throw new Error("No fish detected in image");
  }

  // Use the crop with highest YOLO confidence
  const bestCrop = crops.reduce((best, curr) =>
    curr.yolo_confidence > best.yolo_confidence ? curr : best,
  );

  // Weight and price are not available from the ML API - mark as unavailable (0)
  const estimatedWeight = 0;
  const estimatedPricePerKg = 0;
  const estimatedLength = 0;
  const minLegalSize = 150;

  return {
    species: bestCrop.species.label,
    scientificName: "",
    confidence: bestCrop.species.confidence,
    measurements: {
      length_mm: 0,
      weight_g: 0,
      width_mm: 0,
    },
    qualityGrade:
      bestCrop.disease.label === "Healthy Fish" ? "Premium" : "Standard",
    marketEstimate: {
      price_per_kg: 0,
      estimated_value: 0,
    },
    compliance: {
      is_legal_size: false,
      min_legal_size_mm: minLegalSize,
    },
    isSustainable: bestCrop.disease.label === "Healthy Fish",
    weightEstimate: 0,
    weightConfidence: 0,
    marketPriceEstimate: 0,
    timestamp: new Date().toISOString(),
  };
}

export async function getImages(
  limit = 20,
  lastKey?: string,
): Promise<{ items: ImageRecord[]; lastKey?: string }> {
  if (IS_DEMO_MODE) {
    return { items: [] };
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (lastKey) params.set("lastKey", lastKey);
  const response = await apiFetch<{
    items?: ImageRecord[];
    images?: ImageRecord[];
    lastKey?: string;
  }>(`${ENDPOINTS.getImages}?${params}`);
  return {
    items: response.items ?? response.images ?? [],
    lastKey: response.lastKey,
  };
}

export async function getMapData(filters?: {
  species?: string;
  from?: string;
  to?: string;
}): Promise<MapDataResponse> {
  if (IS_DEMO_MODE) {
    return { markers: [] };
  }
  const params = new URLSearchParams();
  if (filters?.species) params.set("species", filters.species);
  const query = params.toString() ? `?${params}` : "";
  return apiFetch(`${ENDPOINTS.getMapData}${query}`);
}

export interface FishingSpot {
  name: string;
  parent_water_body: string;
  latitude: number;
  longitude: number;
  type: string;
  is_sub_point: boolean;
  distance_km: number;
  weather_score: number;
  fish_density_score: number;
  transport_score: number;
  chlorophyll_available: boolean;
  gemini_web_score: number | null;
  confidence: number;
  color: string;
}

export interface FishingSpotsResponse {
  spots: FishingSpot[];
  user_location: { lat: number; lon: number };
  total_bodies_found: number;
  summary: string;
}

export async function getFishingSpots(
  lat: number,
  lon: number,
  radiusKm = 50,
): Promise<FishingSpotsResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius_km: String(radiusKm),
  });
  return agentFetch<FishingSpotsResponse>(`/fishing-spots?${params}`);
}

export async function sendChat(
  message: string,
  overrideChatId?: string,
  language?: string,
  location?: { latitude: number; longitude: number },
  replyToMessageId?: string,
  analysisId?: string,
  groupId?: string,
): Promise<SendChatResponse> {
  if (!message || !message.trim()) {
    throw new ApiError(400, "Message is required");
  }

  if (IS_AGENT_CONFIGURED) {
    try {
      if (overrideChatId) {
        const payload: any = { message, language };
        if (location) {
          payload.location = location;
        }
        if (replyToMessageId) {
          payload.replyToMessageId = replyToMessageId;
        }
        if (analysisId) {
          payload.analysisId = analysisId;
        }
        if (groupId) {
          payload.groupId = groupId;
        }

        console.log("----------------------------------------");
        console.log("🚀 SENDING PROMPT TO AGENT (REST):");
        console.log(`🆔 Conv ID: ${overrideChatId}`);
        console.log("📦 JSON Body:", JSON.stringify(payload, null, 2));
        console.log("----------------------------------------");

        const res = await retryWithBackoff(
          () =>
            agentFetch<{
              success: boolean;
              response: { content: string; messageId: string };
            }>(`/conversations/${overrideChatId}/messages`, {
              method: "POST",
              body: JSON.stringify(payload),
            }),
          {
            ...RETRY_PRESETS.STANDARD,
            onRetry: (attempt, error) => {
              console.log(
                `Retrying chat message (attempt ${attempt}):`,
                error.message,
              );
            },
          },
        );

        return {
          chatId: overrideChatId,
          response: res.response.content,
          timestamp: new Date().toISOString(),
        };
      }

      const payload: any = { message, language };
      if (location) {
        payload.location = location;
      }
      if (replyToMessageId) {
        payload.replyToMessageId = replyToMessageId;
      }
      if (analysisId) {
        payload.analysisId = analysisId;
      }
      if (groupId) {
        payload.groupId = groupId;
      }

      console.log("----------------------------------------");
      console.log("🚀 SENDING PROMPT TO AGENT (LEGACY/GLOBAL):");
      console.log("📦 JSON Body:", JSON.stringify(payload, null, 2));
      console.log("----------------------------------------");

      return await retryWithBackoff(
        () =>
          agentFetch<SendChatResponse>("/chat", {
            method: "POST",
            body: JSON.stringify(payload),
          }),
        {
          ...RETRY_PRESETS.STANDARD,
          onRetry: (attempt, error) => {
            console.log(
              `Retrying chat message (attempt ${attempt}):`,
              error.message,
            );
          },
        },
      );
    } catch (error) {
      console.error("Failed to send chat message:", error);
      throw new ApiError(
        error instanceof ApiError ? error.status : 0,
        `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Chat is not available. Configure EXPO_PUBLIC_AGENT_URL or EXPO_PUBLIC_API_URL.",
    );
  }

  try {
    return await retryWithBackoff(
      () =>
        apiFetch<SendChatResponse>(ENDPOINTS.sendChat, {
          method: "POST",
          body: JSON.stringify({ message }),
        }),
      {
        ...RETRY_PRESETS.STANDARD,
        onRetry: (attempt, error) => {
          console.log(
            `Retrying chat message (attempt ${attempt}):`,
            error.message,
          );
        },
      },
    );
  } catch (error) {
    console.error("Failed to send chat message:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export class ChatError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}
export async function getChatHistory(
  limit = 30,
  overrideChatId?: string,
): Promise<UnifiedMessage[]> {
  if (IS_AGENT_CONFIGURED) {
    try {
      if (overrideChatId) {
        const res = await retryWithBackoff(() =>
          agentFetch<any>(
            `/conversations/${overrideChatId}/messages?limit=${limit}`,
          ),
        );
        const fetchedMessages = Array.isArray(res.messages)
          ? res.messages
          : res.success && Array.isArray(res.response)
            ? res.response
            : null;
        if (fetchedMessages) {
          return fetchedMessages.map((m: any) => ({
            id: m.messageId || m.id,
            role: m.role,
            text: m.content || m.text,
            timestamp: m.timestamp || new Date().toISOString(),
            uiActions: m.metadata?.ui,
          }));
        }
        return [];
      }

      // Fallback for old /chat endpoint
      const oldLog = await retryWithBackoff(() =>
        agentFetch<ChatMessage[]>(`/chat?limit=${limit}`),
      );
      return oldLog.map((m) => ({
        id: m.chatId,
        role: "assistant" as const,
        text: m.response,
        timestamp: m.timestamp,
      }));
    } catch (error) {
      console.error("Failed to get chat history:", error);
      // Return empty array on error to allow graceful degradation
      return [];
    }
  }

  if (IS_DEMO_MODE) {
    return [];
  }

  try {
    const apiLog = await retryWithBackoff(() =>
      apiFetch<ChatMessage[]>(`${ENDPOINTS.getChatHistory}?limit=${limit}`),
    );
    return apiLog.map((m) => ({
      id: m.chatId,
      role: "assistant" as const,
      text: m.response,
      timestamp: m.timestamp,
    }));
  } catch (error) {
    console.error("Failed to get chat history:", error);
    // Return empty array on error to allow graceful degradation
    return [];
  }
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string,
): Promise<{ audioBase64: string }> {
  if (IS_DEMO_MODE) {
    return { audioBase64: "" };
  }
  return apiFetch<{ audioBase64: string }>("/tts", {
    method: "POST",
    body: JSON.stringify({ text, languageCode }),
  });
}

export async function createConversation(
  title: string = "New Chat",
  language: string = "en",
): Promise<Conversation> {
  if (!IS_AGENT_CONFIGURED) {
    throw new ApiError(
      0,
      "Chat is not available. Configure EXPO_PUBLIC_AGENT_URL.",
    );
  }

  if (!title || !title.trim()) {
    throw new ApiError(400, "Conversation title is required");
  }

  try {
    const res = await retryWithBackoff(
      () =>
        agentFetch<{ conversation: Conversation }>("/conversations", {
          method: "POST",
          body: JSON.stringify({ title, language }),
        }),
      {
        ...RETRY_PRESETS.STANDARD,
        onRetry: (attempt, error) => {
          console.log(
            `Retrying create conversation (attempt ${attempt}):`,
            error.message,
          );
        },
      },
    );
    return res.conversation;
  } catch (error) {
    console.error("Failed to create conversation:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to create conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function getConversationsList(): Promise<Conversation[]> {
  if (!IS_AGENT_CONFIGURED) {
    return [];
  }

  try {
    const res = await retryWithBackoff(
      () =>
        agentFetch<{ conversations: Conversation[] }>(
          "/conversations?limit=20",
        ),
      {
        ...RETRY_PRESETS.FAST,
        onRetry: (attempt, error) => {
          console.log(
            `Retrying get conversations list (attempt ${attempt}):`,
            error.message,
          );
        },
      },
    );
    return res.conversations;
  } catch (error) {
    console.error("Failed to get conversations list:", error);
    // Return empty array on error to allow graceful degradation
    return [];
  }
}

export async function getConversation(
  conversationId: string,
): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> {
  if (!IS_AGENT_CONFIGURED) {
    throw new ApiError(
      0,
      "Chat is not available. Configure EXPO_PUBLIC_AGENT_URL.",
    );
  }

  if (!conversationId || !conversationId.trim()) {
    throw new ApiError(400, "Conversation ID is required");
  }

  try {
    const [conversationRes, messagesRes] = await Promise.all([
      agentFetch<{ conversation: Conversation }>(
        `/conversations/${conversationId}`,
      ),
      agentFetch<{ messages: ConversationMessage[] }>(
        `/conversations/${conversationId}/messages?limit=100`,
      ),
    ]);

    return {
      conversation: conversationRes.conversation,
      messages: messagesRes.messages,
    };
  } catch (error) {
    console.error("Failed to get conversation:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to load conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  if (!IS_AGENT_CONFIGURED) {
    throw new ApiError(
      0,
      "Chat is not available. Configure EXPO_PUBLIC_AGENT_URL.",
    );
  }

  if (!conversationId || !conversationId.trim()) {
    throw new ApiError(400, "Conversation ID is required");
  }

  try {
    await agentFetch(`/conversations/${conversationId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to delete conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function exportConversation(
  conversationId: string,
  format: "json" | "txt" = "txt",
): Promise<{ downloadUrl: string; content?: string }> {
  if (!IS_AGENT_CONFIGURED) {
    throw new ApiError(
      0,
      "Chat is not available. Configure EXPO_PUBLIC_AGENT_URL.",
    );
  }

  if (!conversationId || !conversationId.trim()) {
    throw new ApiError(400, "Conversation ID is required");
  }

  try {
    return await agentFetch<{ downloadUrl: string; content?: string }>(
      `/conversations/${conversationId}/export`,
      {
        method: "POST",
        body: JSON.stringify({ format }),
      },
    );
  } catch (error) {
    console.error("Failed to export conversation:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to export conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function getAnalytics(): Promise<AnalyticsResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Analytics not available. Backend API is not configured.",
    );
  }
  return apiFetch<AnalyticsResponse>(ENDPOINTS.getAnalytics);
}

/**
 * Export analytics as PDF from backend
 * Uses SLOW retry preset for long-running PDF generation
 * Includes timeout handling (60 seconds) for large reports
 *
 * @param options - Export options (date range, filters, etc.)
 * @returns PDF file URL or base64 data
 */
export async function exportAnalyticsPDF(options?: {
  dateRange?: { from: string; to: string };
  includeCharts?: boolean;
  includeCatchHistory?: boolean;
}): Promise<{ downloadUrl?: string; pdfData?: string; fileSize?: number }> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "PDF export not available. Backend API is not configured.",
    );
  }

  try {
    // Use SLOW retry preset for potentially long-running PDF generation
    // Timeout after 60 seconds for large reports
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const result = await retryWithBackoff(
        () =>
          apiFetch<{
            downloadUrl?: string;
            pdfData?: string;
            fileSize?: number;
          }>("/analytics/export/pdf", {
            method: "POST",
            body: JSON.stringify(options || {}),
            signal: controller.signal,
          }),
        {
          ...RETRY_PRESETS.SLOW,
          onRetry: (attempt, error) => {
            console.log(
              `Retrying PDF export (attempt ${attempt}):`,
              error.message,
            );
          },
        },
      );

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    console.error("Failed to export analytics PDF:", error);

    // Provide user-friendly error messages
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        408,
        "PDF generation timed out. Please try again with a smaller date range.",
      );
    }

    if (error instanceof ApiError) {
      if (error.status === 413) {
        throw new ApiError(
          413,
          "Report is too large to generate. Please select a smaller date range.",
        );
      } else if (error.status === 503) {
        throw new ApiError(
          503,
          "PDF generation service is temporarily unavailable. Please try again later.",
        );
      }
    }

    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to export PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Group-based Multi-Image API ───────────────────────────────────────────────

/**
 * Request presigned URLs for multiple images in a group.
 */
export async function createGroupPresignedUrls(
  files: { fileName: string; fileType: string }[],
  latitude?: number,
  longitude?: number,
): Promise<GroupPresignedUrlResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable group uploads.",
    );
  }
  return apiFetch<GroupPresignedUrlResponse>("/groups/presigned-urls", {
    method: "POST",
    body: JSON.stringify({ files, latitude, longitude }),
  });
}

/**
 * Upload multiple files to S3 concurrently via presigned URLs.
 */
export async function uploadGroupToS3(
  presignedUrls: { index: number; uploadUrl: string }[],
  fileUris: string[],
  fileTypes: string[],
  onProgress?: (index: number, pct: number) => void,
): Promise<void> {
  const uploads = presignedUrls.map(({ index, uploadUrl }) => {
    const fileUri = fileUris[index];
    const fileType = fileTypes[index];
    if (!fileUri) return Promise.resolve();
    return uploadToS3(uploadUrl, fileUri, fileType, (pct) =>
      onProgress?.(index, pct),
    );
  });
  await Promise.all(uploads);
}

/**
 * Trigger ML analysis for a group of images.
 */
export async function analyzeGroup(
  groupId: string,
): Promise<{ groupId: string; analysisResult: GroupAnalysis }> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable group analysis.",
    );
  }
  return apiFetch<{ groupId: string; analysisResult: GroupAnalysis }>(
    `/groups/${groupId}/analyze`,
    {
      method: "POST",
    },
  );
}

/**
 * Fetch user's group history.
 */
export async function getGroups(
  limit = 20,
  lastKey?: string,
): Promise<GroupListResponse> {
  if (IS_DEMO_MODE) {
    return { groups: [] };
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (lastKey) params.set("lastKey", lastKey);

  // Backend returns { items: [...], lastKey?: string }
  const apiResponse = await apiFetch<{
    items: GroupRecord[];
    lastKey?: string;
  }>(`/groups?${params}`);

  // Map items to groups for consistency with frontend
  return {
    groups: apiResponse.items || [],
    lastKey: apiResponse.lastKey,
  };
}

/**
 * Fetch detailed group analysis results.
 */
export async function getGroupDetails(groupId: string): Promise<GroupRecord> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Backend API is not configured.");
  }
  return apiFetch<GroupRecord>(`/groups/${groupId}`);
}

/**
 * Delete a group from history.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Backend API is not configured.");
  }
  await apiFetch<void>(`/groups/${groupId}`, {
    method: "DELETE",
  });
}

// ── Avatar Management API ─────────────────────────────────────────────────────
//
// Enhanced with:
// - Comprehensive error handling with user-friendly messages
// - Retry logic with exponential backoff for transient failures
// - Input validation to catch errors early
// - Detailed error logging for debugging
//
// All avatar functions use the following retry strategy:
// - FAST preset for presigned URL requests (3 retries: 1s, 2s, 4s)
// - STANDARD preset for avatar updates/deletions (3 retries: 2s, 4s, 8s)
// - Retries on: network errors, timeouts, 408, 429, 500, 502, 503, 504 status codes
// - Non-retryable errors (4xx except 408/429) fail immediately

/**
 * Get presigned URL for avatar upload
 * Uses retry logic for transient failures
 */
export async function getAvatarPresignedUrl(
  fileName: string,
  fileType: string,
): Promise<{ uploadUrl: string; s3Key: string; avatarUrl: string }> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Avatar upload not available in demo mode");
  }

  try {
    return await apiFetchWithRetry<{
      uploadUrl: string;
      s3Key: string;
      avatarUrl: string;
    }>(
      "/user/avatar/presigned-url",
      {
        method: "POST",
        body: JSON.stringify({ fileName, fileType }),
      },
      RETRY_PRESETS.FAST,
    );
  } catch (error) {
    console.error("Failed to get avatar presigned URL:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to prepare avatar upload: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Update user's avatar URL after successful upload
 * Uses retry logic for transient failures
 */
export async function updateAvatarUrl(avatarUrl: string): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Avatar updates not available in demo mode");
  }

  if (!avatarUrl || !avatarUrl.trim()) {
    throw new ApiError(400, "Avatar URL is required");
  }

  try {
    await apiFetchWithRetry<void>(
      "/user/avatar",
      {
        method: "PUT",
        body: JSON.stringify({ avatarUrl }),
      },
      RETRY_PRESETS.STANDARD,
    );
  } catch (error) {
    console.error("Failed to update avatar URL:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to update avatar: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Remove user's avatar
 * Uses retry logic for transient failures
 */
export async function removeAvatar(): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Avatar removal not available in demo mode");
  }

  try {
    await apiFetchWithRetry<void>(
      "/user/avatar",
      {
        method: "DELETE",
      },
      RETRY_PRESETS.STANDARD,
    );
  } catch (error) {
    console.error("Failed to remove avatar:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to remove avatar: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Profile Management API ───────────────────────────────────────────────────
//
// Enhanced with:
// - Comprehensive error handling with user-friendly messages
// - Retry logic with exponential backoff for transient failures
// - Input validation to catch errors early
// - Detailed error logging for debugging
//
// All profile functions use the following retry strategy:
// - FAST preset for profile reads (3 retries: 1s, 2s, 4s)
// - STANDARD preset for profile updates (3 retries: 2s, 4s, 8s)
// - Retries on: network errors, timeouts, 408, 429, 500, 502, 503, 504 status codes
// - Non-retryable errors (4xx except 408/429) fail immediately

/**
 * Get user profile (includes embedded preferences)
 * Uses retry logic for transient failures
 */
export async function getUserProfile(): Promise<UserProfile> {
  if (IS_DEMO_MODE) {
    return {
      userId: "demo-user",
      email: "demo@mastyaai.com",
      name: "Demo Fisherman",
      phone: "+91 9876543210",
      port: "Mumbai",
      role: "Fisherman",
      publicProfileEnabled: false,
      preferences: {
        language: "en",
        notifications: true,
        offlineSync: true,
        units: "kg",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    // Backend returns { profile: {...} }
    const response = await apiFetchWithRetry<{ profile: UserProfile }>(
      "/user/profile",
      {},
      RETRY_PRESETS.FAST,
    );
    return response.profile;
  } catch (error) {
    console.error("Failed to get user profile:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to load profile: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Update user profile
 * Uses retry logic for transient failures
 */
export async function updateUserProfile(
  profile: Partial<UserProfile>,
): Promise<UserProfile> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Profile updates not available in demo mode");
  }

  if (!profile || Object.keys(profile).length === 0) {
    throw new ApiError(400, "Profile data is required");
  }

  try {
    // Backend returns { profile: {...} }
    const response = await apiFetchWithRetry<{ profile: UserProfile }>(
      "/user/profile",
      {
        method: "PUT",
        body: JSON.stringify(profile),
      },
      RETRY_PRESETS.STANDARD,
    );
    return response.profile;
  } catch (error) {
    console.error("Failed to update user profile:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to update profile: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Public Profile API ────────────────────────────────────────────────────────
//
// The backend has NO separate public-profile endpoints. Instead:
//   - GET  /user/profile       → returns the full user profile including
//                                 publicProfileEnabled, publicProfileSlug, showPublicStats
//   - PUT  /user/profile       → updates those same fields
//   - GET  /user/public/:slug  → unauthenticated; returns the public-facing profile
//
// These helper functions map between the backend field names
// (publicProfileEnabled, publicProfileSlug, showPublicStats) and the mobile
// PublicProfile type (isPublic, slug, showStats).

/** Map a UserProfile to the mobile PublicProfile shape */
function mapUserProfileToPublicProfile(p: UserProfile): PublicProfile {
  return {
    slug: p.publicProfileSlug || "",
    userId: p.userId,
    name: p.name || "",
    avatarUrl: p.avatar,
    role: p.role,
    port: p.port,
    region: p.region,
    isPublic: p.publicProfileEnabled ?? false,
    showStats: p.showPublicStats ?? false,
    createdAt: p.createdAt,
  };
}

/**
 * Get user's public profile settings.
 * Reads from GET /user/profile and maps the relevant fields.
 */
export async function getPublicProfile(): Promise<PublicProfile> {
  if (IS_DEMO_MODE) {
    return {
      slug: "demo-fisherman",
      userId: "demo-user",
      name: "Demo Fisherman",
      role: "Fisherman",
      port: "Mumbai",
      isPublic: false,
      showStats: false,
      createdAt: new Date().toISOString(),
    };
  }

  try {
    const profile = await getUserProfile();
    return mapUserProfileToPublicProfile(profile);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      console.warn(
        "User profile not found (404). Returning default public profile.",
      );
      return DEFAULT_PUBLIC_PROFILE;
    }
    console.error("Failed to get public profile:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to load public profile: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Update public profile settings.
 * Sends publicProfileEnabled, showPublicStats, publicProfileSlug
 * to PUT /user/profile.
 */
export async function updatePublicProfile(settings: {
  isPublic: boolean;
  showStats: boolean;
  slug?: string;
}): Promise<PublicProfile> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Public profile updates not available in demo mode");
  }

  const payload: Partial<UserProfile> = {
    publicProfileEnabled: settings.isPublic,
    showPublicStats: settings.showStats,
  };
  if (settings.slug) {
    payload.publicProfileSlug = settings.slug;
  }

  try {
    const updated = await updateUserProfile(payload);
    return mapUserProfileToPublicProfile(updated);
  } catch (error) {
    console.error("Failed to update public profile:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to update public profile: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Generate a unique slug for public profile (client-side, matching frontend approach).
 * Fetches the user profile for name/userId, creates the slug, and saves it.
 */
export async function generatePublicSlug(): Promise<{
  slug: string;
  url: string;
}> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Slug generation not available in demo mode");
  }

  try {
    const profile = await getUserProfile();
    const name = profile.name || "fisherman";
    const id = profile.userId || "";
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 20);
    const slug = `${base}-${id.slice(0, 8)}`;
    const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || "https://mastyaai.app";
    const url = `${baseUrl}/profile/${slug}`;

    // Persist the slug on the user profile
    await updateUserProfile({ publicProfileSlug: slug });

    return { slug, url };
  } catch (error) {
    console.error("Failed to generate public slug:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to generate profile link: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get public profile by slug (for viewing others' profiles).
 * Calls GET /user/public/:slug and maps the backend response.
 */
export async function getPublicProfileBySlug(
  slug: string,
): Promise<PublicProfile> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Public profiles not available in demo mode");
  }

  if (!slug || !slug.trim()) {
    throw new ApiError(400, "Profile slug is required");
  }

  try {
    // Backend returns { profile: { name, avatar, port, ... , stats? } }
    const response = await apiFetchWithRetry<{ profile: Record<string, any> }>(
      `/user/public/${encodeURIComponent(slug)}`,
      {},
      RETRY_PRESETS.FAST,
    );
    const p = response.profile;
    return {
      slug: p.publicProfileSlug || slug,
      userId: "",
      name: p.name || "",
      avatarUrl: p.avatar,
      role: p.role,
      port: p.port,
      region: p.region,
      isPublic: true,
      showStats: p.showPublicStats ?? false,
      stats: p.stats
        ? {
            totalCatches: p.stats.totalFish || 0,
            speciesCount: p.stats.uniqueSpecies || 0,
            totalEarnings: 0,
            speciesDistribution: {},
          }
        : undefined,
      createdAt: p.createdAt || "",
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      console.warn(
        `Public profile for slug ${slug} not found (404). Returning default public profile.`,
      );
      return DEFAULT_PUBLIC_PROFILE;
    }
    console.error("Failed to get public profile by slug:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to load public profile: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── User Preferences API ──────────────────────────────────────────────────────

/**
 * Get user preferences (now embedded in profile, this is a convenience wrapper)
 * Uses retry logic for transient failures
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  if (IS_DEMO_MODE) {
    return {
      language: "en",
      notifications: true,
      offlineSync: true,
      units: "kg",
    };
  }

  try {
    const profile = await getUserProfile();
    return profile.preferences || DEFAULT_USER_PREFERENCES;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      console.warn(
        "Preferences not found (404). Returning default preferences.",
      );
      return DEFAULT_USER_PREFERENCES;
    }
    console.error("Failed to get user preferences:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to load preferences: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Update user preferences (updates the profile with new preferences)
 * Uses retry logic for transient failures
 */
export async function updateUserPreferences(
  preferences: Partial<UserPreferences>,
): Promise<UserPreferences> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Preferences updates not available in demo mode");
  }

  if (!preferences || Object.keys(preferences).length === 0) {
    throw new ApiError(400, "Preferences data is required");
  }

  try {
    // Get current profile to merge preferences
    const currentProfile = await getUserProfile();
    const updatedPreferences = {
      ...currentProfile.preferences,
      ...preferences,
    };

    // Update profile with new preferences
    const updatedProfile = await updateUserProfile({
      preferences: updatedPreferences,
    });

    return updatedProfile.preferences;
  } catch (error) {
    console.error("Failed to update user preferences:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to update preferences: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Change password
 * Uses retry logic for transient failures
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Password change not available in demo mode");
  }

  if (!oldPassword || !oldPassword.trim()) {
    throw new ApiError(400, "Current password is required");
  }

  if (!newPassword || !newPassword.trim()) {
    throw new ApiError(400, "New password is required");
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  if (oldPassword === newPassword) {
    throw new ApiError(
      400,
      "New password must be different from current password",
    );
  }

  try {
    await apiFetchWithRetry<void>(
      "/user/password",
      {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      },
      RETRY_PRESETS.STANDARD,
    );
  } catch (error) {
    console.error("Failed to change password:", error);
    // Provide more specific error messages
    if (error instanceof ApiError) {
      if (error.status === 401) {
        throw new ApiError(401, "Current password is incorrect");
      } else if (error.status === 400) {
        throw new ApiError(400, error.message || "Invalid password format");
      }
    }
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to change password: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Data Export API ───────────────────────────────────────────────────────────

/**
 * Export user data
 * Uses slower retry logic due to potentially long processing time
 */
export async function exportUserData(
  options: import("./types").DataExportOptions,
): Promise<{ downloadUrl: string; fileSize: number }> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Data export not available in demo mode");
  }

  if (!options || Object.keys(options).length === 0) {
    throw new ApiError(400, "Export options are required");
  }

  try {
    return await apiFetchWithRetry<{ downloadUrl: string; fileSize: number }>(
      "/export/data",
      {
        method: "POST",
        body: JSON.stringify(options),
      },
      RETRY_PRESETS.SLOW, // Use slower retry for potentially long-running export
    );
  } catch (error) {
    console.error("Failed to export user data:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to export data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Account Management API ────────────────────────────────────────────────────

/**
 * Delete user account
 * Uses standard retry logic
 */
export async function deleteUserAccount(): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Account deletion not available in demo mode");
  }

  try {
    await apiFetchWithRetry<void>(
      "/account",
      { method: "DELETE" },
      RETRY_PRESETS.STANDARD,
    );
  } catch (error) {
    console.error("Failed to delete user account:", error);
    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to delete account: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Weather and Ocean Data API ────────────────────────────────────────────────

/**
 * Get weather data for a location
 */
export async function getWeatherData(
  latitude: number,
  longitude: number,
): Promise<import("./types").WeatherData> {
  if (IS_DEMO_MODE) {
    return {
      location: { latitude, longitude },
      temperature: 28,
      windSpeed: 15,
      windDirection: 180,
      waveHeight: 1.5,
      visibility: 10,
      seaState: "Moderate",
      timestamp: new Date().toISOString(),
    };
  }
  return apiFetch(`/weather?lat=${latitude}&lng=${longitude}`);
}

/**
 * Get fishing zones in a region
 * Returns empty array (feature not implemented in backend)
 */
export async function getFishingZones(region: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<import("./types").FishingZone[]> {
  // Feature not implemented in backend - return empty array
  return [];
}

/**
 * Get disaster alerts in a region
 */
export async function getDisasterAlerts(region: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<import("./types").DisasterAlert[]> {
  if (IS_DEMO_MODE) {
    return [];
  }
  const { latitude, longitude, radius } = region;
  return apiFetch(`/alerts?lat=${latitude}&lng=${longitude}&radius=${radius}`);
}

/**
 * Get tide data for a location
 */
export async function getTideData(
  latitude: number,
  longitude: number,
  date: string,
): Promise<{ high: string[]; low: string[] }> {
  if (IS_DEMO_MODE) {
    return {
      high: ["06:30", "18:45"],
      low: ["00:15", "12:30"],
    };
  }
  return apiFetch(`/tides?lat=${latitude}&lng=${longitude}&date=${date}`);
}

// ── NEW: Enhanced Map API Functions ──────────────────────────────────────────
//
// Enhanced with:
// - Comprehensive error handling with user-friendly messages
// - Retry logic with exponential backoff for transient failures (FAST preset)
// - Tile caching strategy for weather layers using AsyncStorage
// - Offline mode fallback (return cached data when offline)
// - Input validation to catch errors early
// - Detailed error logging for debugging
//
// All map functions use FAST retry preset (3 retries: 1s, 2s, 4s) for read operations
// Retries on: network errors, timeouts, 408, 429, 500, 502, 503, 504 status codes
// Non-retryable errors (4xx except 408/429) fail immediately

/**
 * Get weather layer tiles for map overlay
 * Supports 4 layers: temperature, wind, pressure, clouds
 * Uses OpenWeatherMap tiles directly (no backend call needed)
 *
 * @param layer - Weather layer type (temperature, wind, pressure, clouds)
 * @param zoom - Map zoom level (optional)
 * @param bounds - Map bounds for tile selection (optional)
 * @returns Weather layer tile URLs and metadata
 */
export async function getWeatherLayerTiles(
  layer: "temperature" | "wind" | "pressure" | "clouds",
  zoom?: number,
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
): Promise<{
  tileUrlTemplate: string;
  opacity: number;
  legend: Array<{ value: number; color: string; label: string }>;
  timestamp: string;
}> {
  // Map layer names to OpenWeatherMap layer codes
  const layerMap: Record<string, string> = {
    temperature: "temp_new",
    wind: "wind_new",
    pressure: "pressure_new",
    clouds: "clouds_new",
  };

  const owmLayer = layerMap[layer];
  const apiKey = process.env.EXPO_PUBLIC_OWM_API_KEY || "";

  // Return tile configuration (using OpenWeatherMap directly)
  return {
    tileUrlTemplate: `https://tile.openweathermap.org/map/${owmLayer}/{z}/{x}/{y}.png?appid=${apiKey}`,
    opacity: 0.6,
    legend: getLegendForLayer(layer),
    timestamp: new Date().toISOString(),
  };
}

function getLegendForLayer(
  layer: string,
): Array<{ value: number; color: string; label: string }> {
  const legends: Record<
    string,
    Array<{ value: number; color: string; label: string }>
  > = {
    temperature: [
      { value: -40, color: "#800080", label: "-40°C" },
      { value: -20, color: "#0000FF", label: "-20°C" },
      { value: 0, color: "#00FFFF", label: "0°C" },
      { value: 20, color: "#00FF00", label: "20°C" },
      { value: 40, color: "#FFFF00", label: "40°C" },
    ],
    wind: [
      { value: 0, color: "#FFFFFF", label: "0 m/s" },
      { value: 5, color: "#00FF00", label: "5 m/s" },
      { value: 10, color: "#FFFF00", label: "10 m/s" },
      { value: 15, color: "#FF0000", label: "15 m/s" },
    ],
    pressure: [
      { value: 950, color: "#FF0000", label: "950 hPa" },
      { value: 1000, color: "#FFFF00", label: "1000 hPa" },
      { value: 1013, color: "#00FF00", label: "1013 hPa" },
      { value: 1050, color: "#0000FF", label: "1050 hPa" },
    ],
    clouds: [
      { value: 0, color: "#FFFFFF", label: "0%" },
      { value: 25, color: "#CCCCCC", label: "25%" },
      { value: 50, color: "#999999", label: "50%" },
      { value: 75, color: "#666666", label: "75%" },
      { value: 100, color: "#333333", label: "100%" },
    ],
  };

  return legends[layer] || [];
}

/**
 * Get weather data for a tapped location on the map
 * Provides detailed weather information for a specific coordinate
 *
 * @param latitude - Location latitude
 * @param longitude - Location longitude
 * @returns Detailed weather data including forecast
 */
export async function getLocationWeather(
  latitude: number,
  longitude: number,
): Promise<{
  current: {
    temperature: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    humidity: number;
    conditions: string;
    icon: string;
  };
  forecast: Array<{
    time: string;
    temperature: number;
    conditions: string;
    icon: string;
  }>;
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
}> {
  const apiKey = process.env.EXPO_PUBLIC_OWM_API_KEY || "";

  if (!apiKey || IS_DEMO_MODE) {
    return {
      current: {
        temperature: 28,
        windSpeed: 15,
        windDirection: 180,
        pressure: 1013,
        humidity: 75,
        conditions: "Partly Cloudy",
        icon: "partly-cloudy",
      },
      forecast: [
        {
          time: new Date(Date.now() + 3600000).toISOString(),
          temperature: 27,
          conditions: "Cloudy",
          icon: "cloudy",
        },
        {
          time: new Date(Date.now() + 7200000).toISOString(),
          temperature: 26,
          conditions: "Rain",
          icon: "rainy",
        },
      ],
      location: {
        name: "Arabian Sea",
        latitude,
        longitude,
      },
    };
  }

  // Check cache for offline support
  const cacheKey = `@location_weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
      // Use cached data if less than 30 minutes old
      if (cacheAge < 1800000) {
        console.log(
          `Using cached location weather for ${latitude},${longitude}`,
        );
        return cachedData.data;
      }
    }
  } catch (error) {
    console.warn("Failed to read location weather cache:", error);
  }

  try {
    // Fetch current weather from OpenWeatherMap directly
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;
    const currentResponse = await fetch(currentUrl);

    if (!currentResponse.ok) {
      throw new Error(`OpenWeatherMap API error: ${currentResponse.status}`);
    }

    const currentData = await currentResponse.json();

    // Fetch forecast from OpenWeatherMap
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&cnt=8`;
    const forecastResponse = await fetch(forecastUrl);

    if (!forecastResponse.ok) {
      throw new Error(
        `OpenWeatherMap forecast API error: ${forecastResponse.status}`,
      );
    }

    const forecastData = await forecastResponse.json();

    // Format response
    const result = {
      current: {
        temperature: Math.round(currentData.main.temp),
        windSpeed: Math.round(currentData.wind.speed * 3.6), // Convert m/s to km/h
        windDirection: currentData.wind.deg,
        pressure: currentData.main.pressure,
        humidity: currentData.main.humidity,
        conditions: currentData.weather[0].description,
        icon: currentData.weather[0].icon,
      },
      forecast: forecastData.list.map((item: any) => ({
        time: item.dt_txt,
        temperature: Math.round(item.main.temp),
        conditions: item.weather[0].description,
        icon: item.weather[0].icon,
      })),
      location: {
        name: currentData.name || "Unknown",
        latitude,
        longitude,
      },
    };

    // Cache the result
    try {
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: result,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.warn("Failed to cache location weather:", error);
    }

    return result;
  } catch (error) {
    console.error(
      `Failed to get location weather for ${latitude},${longitude}:`,
      error,
    );

    // Try to return cached data as fallback
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        console.log(
          `Returning cached location weather for ${latitude},${longitude} as fallback`,
        );
        return JSON.parse(cached).data;
      }
    } catch (cacheError) {
      console.warn("Failed to read cache for fallback:", cacheError);
    }

    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to load weather data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get fisherman tools data (sunrise/sunset, moon phase, tides, best fishing times)
 * Provides astronomical and tidal data for fishing planning
 *
 * @param latitude - Location latitude
 * @param longitude - Location longitude
 * @param date - Date for calculations (ISO string, defaults to today)
 * @returns Fisherman tools data
 */
export async function getFishermanTools(
  latitude: number,
  longitude: number,
  date?: string,
): Promise<{
  location: { latitude: number; longitude: number };
  date: string;
  sunrise: string;
  sunset: string;
  moonPhase: {
    phase: string;
    illumination: number;
    icon: string;
  };
  tides: Array<{
    time: string;
    type: "high" | "low";
    height: number;
  }>;
  bestFishingTimes: Array<{
    start: string;
    end: string;
    quality: "good" | "better" | "best";
  }>;
}> {
  // Calculate astronomical data locally (simplified calculations)
  // In production, this could use a library like suncalc
  const targetDate = date ? new Date(date) : new Date();
  const dateStr = targetDate.toISOString().split("T")[0];

  // Simplified sunrise/sunset calculation
  const dayOfYear = Math.floor(
    (targetDate.getTime() -
      new Date(targetDate.getFullYear(), 0, 0).getTime()) /
      86400000,
  );
  const sunriseHour = 6 + Math.sin((dayOfYear / 365) * 2 * Math.PI) * 2;
  const sunsetHour = 18 - Math.sin((dayOfYear / 365) * 2 * Math.PI) * 2;

  const sunrise = new Date(targetDate);
  sunrise.setHours(
    Math.floor(sunriseHour),
    Math.floor((sunriseHour % 1) * 60),
    0,
    0,
  );

  const sunset = new Date(targetDate);
  sunset.setHours(
    Math.floor(sunsetHour),
    Math.floor((sunsetHour % 1) * 60),
    0,
    0,
  );

  // Simplified moon phase calculation
  const knownNewMoon = new Date("2000-01-06");
  const lunarCycle = 29.53058867;
  const daysSinceNew =
    (targetDate.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const phase = (daysSinceNew % lunarCycle) / lunarCycle;

  let moonPhaseName, moonIcon;
  if (phase < 0.0625 || phase >= 0.9375) {
    moonPhaseName = "New Moon";
    moonIcon = "🌑";
  } else if (phase < 0.1875) {
    moonPhaseName = "Waxing Crescent";
    moonIcon = "🌒";
  } else if (phase < 0.3125) {
    moonPhaseName = "First Quarter";
    moonIcon = "🌓";
  } else if (phase < 0.4375) {
    moonPhaseName = "Waxing Gibbous";
    moonIcon = "🌔";
  } else if (phase < 0.5625) {
    moonPhaseName = "Full Moon";
    moonIcon = "🌕";
  } else if (phase < 0.6875) {
    moonPhaseName = "Waning Gibbous";
    moonIcon = "🌖";
  } else if (phase < 0.8125) {
    moonPhaseName = "Last Quarter";
    moonIcon = "🌗";
  } else {
    moonPhaseName = "Waning Crescent";
    moonIcon = "🌘";
  }

  const illumination = Math.round((1 - Math.abs(phase - 0.5) * 2) * 100);

  // Generate simplified tide data
  const baseDate = new Date(targetDate);
  baseDate.setHours(0, 0, 0, 0);

  const tides = [
    {
      time: new Date(baseDate.getTime() + 6 * 3600000).toISOString(),
      type: "high" as const,
      height: 1.8 + Math.random() * 0.4,
    },
    {
      time: new Date(baseDate.getTime() + 12 * 3600000).toISOString(),
      type: "low" as const,
      height: 0.3 + Math.random() * 0.2,
    },
    {
      time: new Date(baseDate.getTime() + 18 * 3600000).toISOString(),
      type: "high" as const,
      height: 1.7 + Math.random() * 0.5,
    },
    {
      time: new Date(baseDate.getTime() + 24 * 3600000).toISOString(),
      type: "low" as const,
      height: 0.2 + Math.random() * 0.3,
    },
  ];

  // Calculate best fishing times based on sun and moon
  const bestFishingTimes: Array<{
    start: string;
    end: string;
    quality: "good" | "better" | "best";
  }> = [
    {
      start: new Date(sunrise.getTime() - 3600000).toISOString(),
      end: new Date(sunrise.getTime() + 3600000).toISOString(),
      quality: illumination > 80 ? "best" : "better",
    },
    {
      start: new Date(sunset.getTime() - 3600000).toISOString(),
      end: new Date(sunset.getTime() + 3600000).toISOString(),
      quality: illumination > 80 ? "best" : "better",
    },
  ];

  if (illumination > 50) {
    const midday = new Date((sunrise.getTime() + sunset.getTime()) / 2);
    bestFishingTimes.push({
      start: new Date(midday.getTime() - 1800000).toISOString(),
      end: new Date(midday.getTime() + 1800000).toISOString(),
      quality: "good",
    });
  }

  return {
    location: { latitude, longitude },
    date: dateStr,
    sunrise: sunrise.toISOString(),
    sunset: sunset.toISOString(),
    moonPhase: {
      phase: moonPhaseName,
      illumination,
      icon: moonIcon,
    },
    tides,
    bestFishingTimes,
  };
}

/**
 * Get zone insights with fishing recommendations
 * Provides live fishing conditions and recommendations for a specific zone
 *
 * @param zoneId - Fishing zone ID
 * @returns Zone insights with recommendations
 */
export async function getZoneInsights(zoneId: string): Promise<{
  zoneId: string;
  zoneName: string;
  location: { latitude: number; longitude: number };
  recommendations: {
    fishingConditions: "poor" | "fair" | "good" | "excellent";
    targetSpecies: string[];
    expectedCatchSize: "small" | "medium" | "large";
    safetyRating: number;
  };
  recentActivity: {
    catchCount: number;
    topSpecies: string;
    avgQuality: string;
  };
  updatedAt: string;
}> {
  if (IS_DEMO_MODE) {
    return {
      zoneId,
      zoneName: "Mumbai Coastal Zone",
      location: { latitude: 18.9388, longitude: 72.8354 },
      recommendations: {
        fishingConditions: "good",
        targetSpecies: ["Pomfret", "Mackerel", "Sardine"],
        expectedCatchSize: "medium",
        safetyRating: 8,
      },
      recentActivity: {
        catchCount: 45,
        topSpecies: "Pomfret",
        avgQuality: "Premium",
      },
      updatedAt: new Date().toISOString(),
    };
  }

  // Check cache for offline support
  const cacheKey = `@zone_insights_${zoneId}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      const cacheAge = Date.now() - new Date(cachedData.updatedAt).getTime();
      // Use cached data if less than 1 hour old
      if (cacheAge < 3600000) {
        console.log(`Using cached zone insights for ${zoneId}`);
        return cachedData;
      }
    }
  } catch (error) {
    console.warn("Failed to read zone insights cache:", error);
  }

  try {
    const result = await apiFetchWithRetry<{
      zoneId: string;
      zoneName: string;
      location: { latitude: number; longitude: number };
      recommendations: {
        fishingConditions: "poor" | "fair" | "good" | "excellent";
        targetSpecies: string[];
        expectedCatchSize: "small" | "medium" | "large";
        safetyRating: number;
      };
      recentActivity: {
        catchCount: number;
        topSpecies: string;
        avgQuality: string;
      };
      updatedAt: string;
    }>(`/map/zone-insights/${zoneId}`, {}, RETRY_PRESETS.FAST);

    // Cache the result
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (error) {
      console.warn("Failed to cache zone insights:", error);
    }

    return result;
  } catch (error) {
    console.error(`Failed to get zone insights for ${zoneId}:`, error);

    // Try to return cached data as fallback
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        console.log(`Returning cached zone insights for ${zoneId} as fallback`);
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      console.warn("Failed to read cache for fallback:", cacheError);
    }

    throw new ApiError(
      error instanceof ApiError ? error.status : 0,
      `Failed to load zone insights: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Weight Estimate Sync ──────────────────────────────────────────────────────

export interface WeightEstimatePayload {
  groupId?: string;
  imageUri: string;
  fishIndex: number;
  species: string;
  weightG: number;
  timestamp: string;
  fullEstimate?: OnlineWeightResult;
}

export interface OfflineAnalysisSyncResult {
  remoteId?: string;
}

/**
 * Persist a fish weight estimate to the backend for record-keeping.
 * Silently skips in demo mode (no backend configured).
 */
export async function saveWeightEstimate(
  payload: WeightEstimatePayload,
): Promise<void> {
  if (IS_DEMO_MODE) {
    return; // No backend - persist locally only
  }
  await apiFetch<void>(ENDPOINTS.saveWeightEstimate, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Online Weight Estimation (Agent ML + Formula + Gemini) ────────────────────

export interface OnlineWeightRequest {
  species: string;
  length1: number;
  length3: number;
  height: number;
  width: number;
}

export interface OnlineWeightResult {
  species: string;
  estimated_weight_grams: number;
  estimated_weight_range?: { min_grams: number; max_grams: number };
  ml_predicted_weight_grams?: number;
  formula_calculated_weight_grams?: number;
  market_price_per_kg?: {
    min_inr: number;
    max_inr: number;
    market_reference?: string;
  };
  estimated_fish_value?: { min_inr: number; max_inr: number };
  quality_grade?: string;
  notes?: string;
}

/**
 * Estimate fish weight using the agent's ML + scientific-formula + Gemini pipeline.
 */
export async function estimateFishWeightOnline(
  req: OnlineWeightRequest,
): Promise<OnlineWeightResult> {
  const res = await agentFetch<{ success: boolean; data: OnlineWeightResult }>(
    "/fish-weight/estimate",
    {
      method: "POST",
      body: JSON.stringify(req),
    },
  );
  if (!res.success || !res.data) {
    throw new Error("Weight estimation failed - no data returned");
  }
  return res.data;
}

/**
 * Sync an offline analysis record to the backend.
 * Returns the backend-assigned ID so the local record can be updated.
 */
export async function saveOfflineAnalysis(
  payload: import("./local-history").OfflineAnalysisSyncPayload,
): Promise<OfflineAnalysisSyncResult> {
  if (IS_DEMO_MODE) {
    return {}; // No backend in demo mode
  }
  return apiFetch<OfflineAnalysisSyncResult>(ENDPOINTS.saveOfflineAnalysis, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Offline Session Sync (two-phase: prepare → S3 upload → commit) ────────────

export interface OfflineSessionPreparePayload {
  sessionType: "single" | "group";
  files: { fileName: string; fileType: string }[];
  location?: { lat: number; lng: number } | null;
}

export interface OfflineSessionCommitPayload {
  sessionType: "single" | "group";
  sessionId: string;
  createdAt: string;
  location?: { lat: number; lng: number } | null;
  processingTime?: number;
  // single
  localId?: string;
  detections?: unknown[];
  fishCount?: number;
  avgConfidence?: number;
  speciesDistribution?: Record<string, number>;
  diseaseDetected?: boolean;
  s3Key?: string;
  // group
  localGroupId?: string;
  images?: unknown[];
}

export interface OfflineSessionPrepareResult {
  token: string;
  sessionId: string;
  sessionType: string;
  presignedUrls: { uploadUrl: string; s3Key: string; index: number }[];
}

export interface OfflineSessionCommitResult {
  imageId?: string;
  groupId?: string;
  remoteId?: string;
}

/**
 * Two-phase offline session sync.
 *
 * action = "prepare" → returns presigned S3 URLs
 * action = "commit"  → persists the session to DynamoDB (ai-bharat-images or ai-bharat-groups)
 */
export async function syncOfflineSession(
  action: "prepare" | "commit",
  payload: OfflineSessionPreparePayload | OfflineSessionCommitPayload,
): Promise<OfflineSessionPrepareResult & OfflineSessionCommitResult> {
  if (IS_DEMO_MODE) {
    return {
      token: "",
      sessionId: "",
      sessionType: "single",
      presignedUrls: [],
    };
  }
  const endpoint =
    action === "prepare"
      ? ENDPOINTS.syncOfflineSessionPrepare
      : ENDPOINTS.syncOfflineSessionCommit;
  return apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Convenience object that bundles the most common API calls.
 * Matches the shape expected by integration tests and allows easy mocking.
 */
export const apiClient = {
  uploadImage: getPresignedUrl,
  uploadGroupImages: uploadGroupToS3,
  getImages,
  getGroups,
  getWeatherData,
  getFishingZones,
  getZoneInsights,
  sendChatMessage: sendChat,
  createConversation,
  getConversations: getConversationsList,
  deleteConversation,
  updateUserProfile,
  changePassword,
  exportUserData,
  deleteUserAccount,
  syncOfflineSession,
};
