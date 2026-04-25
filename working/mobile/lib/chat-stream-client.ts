/**
 * Chat Stream Client - SSE streaming from the Agent API.
 *
 * Uses the actual agent endpoint:
 *   POST /conversations/{id}/messages/stream
 *
 * The agent streams back Server-Sent Events in the format:
 *   data: {"type":"chunk","text":"..."}   - LLM token
 *   data: {"type":"tool","name":"..."}    - tool call (informational)
 *   data: {"type":"end","messageId":"..."}  - stream complete
 *   data: {"type":"error","error":"..."}  - error
 *
 * NOTE: React Native's fetch polyfill does NOT expose response.body as a
 * ReadableStream, so we use XMLHttpRequest with onprogress which React Native
 * does support for incremental / streaming reads.
 */

import { AGENT_BASE_URL, IS_AGENT_CONFIGURED } from "./constants";
import { ApiError } from "./api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { handleUnauthorizedError } from "./error-handler";

export interface ContextChip {
  type: "location" | "history" | "upload" | "analytics";
  label: string;
  data?: Record<string, any>;
}

/** UI action hints returned by the agent */
export interface AgentUIActions {
  map: boolean;
  history: boolean;
  upload: boolean;
  mapLat?: number | null;
  mapLon?: number | null;
}

export interface StreamOptions {
  conversationId?: string;
  message: string;
  language?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  replyToMessageId?: string;
  analysisId?: string;
  groupId?: string;
  onToken?: (token: string) => void;
  onToolCall?: (toolName: string) => void;
  onComplete?: (ui?: AgentUIActions) => void;
  onError?: (error: Error) => void;
}

class ChatStreamClient {
  private xhr: XMLHttpRequest | null = null;
  private isStreaming = false;

  private async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("ocean_ai_token");
    } catch {
      return null;
    }
  }

  streamMessage(options: StreamOptions): Promise<void> {
    if (!IS_AGENT_CONFIGURED) {
      return Promise.reject(
        new ApiError(
          0,
          "Agent API is not configured. Set EXPO_PUBLIC_AGENT_URL to enable streaming.",
        ),
      );
    }

    const {
      conversationId,
      message,
      language,
      location,
      replyToMessageId,
      analysisId,
      groupId,
      onToken,
      onToolCall,
      onComplete,
      onError,
    } = options;

    if (!conversationId) {
      return Promise.reject(
        new ApiError(400, "conversationId is required for streaming"),
      );
    }

    if (this.isStreaming) {
      this.stopStreaming();
    }

    this.isStreaming = true;

    return new Promise(async (resolve, reject) => {
      const token = await this.getToken();
      if (!token) {
        handleUnauthorizedError();
        this.isStreaming = false;
        return reject(new ApiError(401, "No auth token found"));
      }

      const url = `${AGENT_BASE_URL}/conversations/${conversationId}/messages/stream`;

      const xhr = new XMLHttpRequest();
      this.xhr = xhr;

      let processedLength = 0;
      let buffer = "";

      const processChunk = (newText: string) => {
        buffer += newText;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "start") {
              // Stream started - ignore, just an initial flush event
            } else if (data.type === "chunk" && data.text) {
              onToken?.(data.text);
            } else if (data.type === "tool" && data.name) {
              onToolCall?.(data.name);
            } else if (data.type === "end") {
              this.isStreaming = false;
              const ui: AgentUIActions | undefined = data.ui
                ? {
                    map: Boolean(data.ui.map),
                    history: Boolean(data.ui.history),
                    upload: Boolean(data.ui.upload),
                    mapLat: data.ui.mapLat ?? null,
                    mapLon: data.ui.mapLon ?? null,
                  }
                : undefined;
              onComplete?.(ui);
              resolve();
            } else if (data.type === "error") {
              const err = new Error(data.error || "Stream error");
              this.isStreaming = false;
              onError?.(err);
              reject(err);
            }
            // "tool" events are silently ignored
          } catch (e) {
            if (!(e instanceof SyntaxError)) {
              this.isStreaming = false;
              onError?.(e as Error);
              reject(e);
            }
          }
        }
      };

      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "text/event-stream");
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.onprogress = () => {
        if (!this.isStreaming) return;
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        if (newText) processChunk(newText);
      };

      xhr.onload = () => {
        // Flush any remaining buffered text
        const newText = xhr.responseText.slice(processedLength);
        if (newText) processChunk(newText);

        if (this.isStreaming) {
          // Stream finished without an explicit "end" event
          this.isStreaming = false;
          onComplete?.();
          resolve();
        }
      };

      xhr.onerror = () => {
        this.isStreaming = false;
        const err = new ApiError(0, "Stream network error");
        onError?.(err);
        reject(err);
      };

      xhr.onabort = () => {
        this.isStreaming = false;
        resolve(); // user-initiated stop, not an error
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
          if (xhr.status === 401) {
            this.isStreaming = false;
            handleUnauthorizedError();
            const err = new ApiError(401, "Unauthorized");
            onError?.(err);
            reject(err);
            xhr.abort();
            return;
          }
          if ((xhr.status !== 0 && xhr.status < 200) || xhr.status >= 300) {
            this.isStreaming = false;
            const err = new ApiError(
              xhr.status,
              `Stream request failed: ${xhr.status}`,
            );
            onError?.(err);
            reject(err);
            xhr.abort();
          }
        }
      };

      const requestBody = {
        message,
        language,
        latitude: location?.latitude,
        longitude: location?.longitude,
        replyToMessageId,
        analysisId,
        groupId,
      };

      const requestTypeMatches = message.match(/\[(.*?)\]/g);
      const requestType = requestTypeMatches
        ? requestTypeMatches.join(" ")
        : "none";

      const headersForLogging = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: "[REDACTED]",
        "X-App-Version": "1.0.0",
      };

      console.log(
        "--- Sending stream request to agent ---",
        JSON.stringify(
          {
            url,
            method: "POST",
            headers: headersForLogging,
            requestType,
            body: requestBody,
          },
          null,
          2,
        ),
      );

      xhr.send(JSON.stringify(requestBody));
    });
  }

  stopStreaming(): void {
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }
    this.isStreaming = false;
  }

  getIsStreaming(): boolean {
    return this.isStreaming;
  }
}

/**
 * Strip __UI__ sentinel lines, leaked JSON UI-action blobs, and memory-system
 * noise from agent text.
 *
 * The agent appends a line like:
 *   __UI__{"map":true,"map_lat":23.09,"map_lon":72.59,"history":false,"upload":false}
 * at the very end of every response. The server strips it before saving and
 * before emitting the SSE `end` event, but the raw tokens arrive as `chunk`
 * events during streaming, so we also strip it here on the client side.
 *
 * We use lastIndexOf("__UI") rather than a regex so partial tokens that arrive
 * mid-stream ("__UI_", "__UI__", "__UI__{", etc.) are caught *before* the
 * markdown renderer turns the leading "__" into bold formatting.
 */
export function sanitiseAgentText(raw: string): string {
  let text = raw;

  // Cut everything from the last occurrence of "__UI" to end-of-string.
  // This handles all streaming states: partial (__UI_), complete header
  // (__UI__), and full line (__UI__{...}).
  const uiIdx = text.lastIndexOf("__UI");
  if (uiIdx !== -1) text = text.slice(0, uiIdx).trimEnd();

  // Strip legacy stray JSON blobs that may appear in error-path responses
  text = text.replace(
    /\{\s*["']?(?:map|history|upload|map_lat|map_lon)["']?\s*:[^}]*\}/g,
    "",
  );

  // Strip memory-system noise that may leak from internal LLM calls
  const noisePatterns = [
    /No facts recorded yet\.?/gi,
    /No new facts to record\.?/gi,
    /No facts recorded\.?/gi,
    /UPDATED FACTS:\s*/gi,
    /- No facts recorded yet\.?/gi,
  ];
  for (const pattern of noisePatterns) {
    text = text.replace(pattern, "");
  }

  return text.trim();
}

/**
 * Parse a stored user message, extract its context chips, and strip tags from content.
 */
export function parseStoredUserMessage(rawText: string): {
  content: string;
  replyTo?: string;
  replyToId?: string;
  locationContext?: { lat: number; lon: number };
  contextChips?: ContextChip[];
} {
  let content = rawText ?? "";
  let replyTo: string | undefined;
  let replyToId: string | undefined;
  let locationContext: { lat: number; lon: number } | undefined;
  const chips: ContextChip[] = [];

  const replyPrefixWithId = content.match(
    /^\[Replying to id:([^\s\]]+)\s+text:\s*"([\s\S]*?)"\]\s*\n\n([\s\S]*)$/,
  );
  if (replyPrefixWithId) {
    replyToId = replyPrefixWithId[1]?.trim();
    replyTo = replyPrefixWithId[2]?.trim();
    content = replyPrefixWithId[3] ?? "";
  }

  const replyPrefix = content.match(
    /^\[Replying to:\s*"([\s\S]*?)"\]\s*\n\n([\s\S]*)$/,
  );
  if (!replyTo && replyPrefix) {
    replyTo = replyPrefix[1]?.trim();
    content = replyPrefix[2] ?? "";
  }

  // Extract mapPin location before stripping tags
  const mapPinMatch = content.match(/\[mapPin:([\d.\-]+),([\d.\-]+)\]/);
  if (mapPinMatch) {
    const lat = parseFloat(mapPinMatch[1]);
    const lon = parseFloat(mapPinMatch[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      locationContext = { lat, lon };
      chips.push({
        type: "location",
        label: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
        data: { lat, lon },
      });
    }
  }

  // Extract groupId for history chip
  const groupIdMatch = content.match(/\[groupId:([^\]]+)\]/);
  if (groupIdMatch) {
    chips.push({
      type: "history",
      label: `Catch #${groupIdMatch[1].slice(0, 8)}`,
      data: { groupId: groupIdMatch[1] },
    });
  }

  // Extract scan/species for upload chip
  const scanMatch = content.match(/\[scan:([^\]]+)\]/);
  const speciesMatch = content.match(/\[species:([^\]]+)\]/);
  if (scanMatch) {
    chips.push({
      type: "upload",
      label: speciesMatch ? `Scan · ${speciesMatch[1]}` : "Scan results",
      data: { summary: scanMatch[1], species: speciesMatch?.[1] },
    });
  }

  // Extract page for analytics chip
  const pageMatch = content.match(/\[page:analytics\]/i);
  if (pageMatch) {
    chips.push({ type: "analytics", label: "Analytics", data: {} });
  }

  // Strip all context bracket tags
  content = content.replace(
    /\[(?:page|lang|userLoc|groupId|species|imgIdx|mapPin|mapZoom|scan|offline|group|image):[^\]]*\]\s*/gi,
    "",
  );

  return {
    content: content.trim(),
    replyTo,
    replyToId,
    locationContext,
    contextChips: chips.length > 0 ? chips : undefined,
  };
}

export const chatStreamClient = new ChatStreamClient();

/**
 * Strip context bracket tags (e.g. [page:...], [userLoc:...]) from a raw
 * user message so only the human-readable text remains for UI display.
 */
export function stripContextTags(text: string): string {
  return text
    .replace(
      /\[(?:Replying to(?:\s+id:[^\s\]]+\s+text:)?\s*:"[\s\S]*?")\]\s*\n\n/gi,
      "",
    )
    .replace(
      /\[(?:page|lang|userLoc|groupId|species|imgIdx|mapPin|mapZoom|scan|offline|group|image):[^\]]*\]\s*/gi,
      "",
    )
    .trim();
}
