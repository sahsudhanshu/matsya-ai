/**
 * Fishing Spots Stream Client
 *
 * Connects to GET /fishing-spots/stream via SSE and provides live progress
 * updates while the agent runs its deep scan.
 *
 * Uses XMLHttpRequest (onprogress) - the same pattern as chat-stream-client.ts
 * since React Native's fetch does not expose a ReadableStream body.
 *
 * SSE event shapes emitted by the server
 * ───────────────────────────────────────
 *   {"type":"progress","stage":"scan","message":"...","pct":N}
 *   {"type":"result","spots":[...],"summary":"...","total_bodies_found":N}
 *   {"type":"error","error":"..."}
 *   {"type":"cancelled"}
 */

import { AGENT_BASE_URL } from "./constants";
import type { FishingSpot } from "./api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ScanProgress {
  stage: string;
  message: string;
  pct: number;
}

export interface ScanResult {
  spots: FishingSpot[];
  summary: string;
  total_bodies_found: number;
}

export interface FishingSpotsStreamOptions {
  lat: number;
  lon: number;
  radiusKm?: number;
  onProgress: (progress: ScanProgress) => void;
  onResult: (result: ScanResult) => void;
  onError: (message: string) => void;
  onCancelled: () => void;
}

export class FishingSpotsStreamClient {
  private xhr: XMLHttpRequest | null = null;
  private active = false;

  private async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("ocean_ai_token");
    } catch {
      return null;
    }
  }

  /** Start a deep scan. Returns a promise that resolves when the stream ends. */
  stream(opts: FishingSpotsStreamOptions): Promise<void> {
    if (this.active) this.cancel();
    this.active = true;

    const {
      lat,
      lon,
      radiusKm = 50,
      onProgress,
      onResult,
      onError,
      onCancelled,
    } = opts;

    return new Promise(async (resolve) => {
      const token = await this.getToken();
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        radius_km: String(radiusKm),
      });
      const url = `${AGENT_BASE_URL}/fishing-spots/stream?${params}`;

      const xhr = new XMLHttpRequest();
      this.xhr = xhr;

      let processedLength = 0;
      let buffer = "";

      const processChunk = (text: string) => {
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              onProgress({
                stage: data.stage,
                message: data.message,
                pct: data.pct,
              });
            } else if (data.type === "result") {
              this.active = false;
              onResult({
                spots: data.spots,
                summary: data.summary,
                total_bodies_found: data.total_bodies_found,
              });
              resolve();
            } else if (data.type === "error") {
              this.active = false;
              onError(data.error || "Unknown scan error");
              resolve();
            } else if (data.type === "cancelled") {
              this.active = false;
              onCancelled();
              resolve();
            }
          } catch {
            // Partial JSON - will be completed in next chunk
          }
        }
      };

      xhr.open("GET", url, true);
      xhr.setRequestHeader("Accept", "text/event-stream");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.onprogress = () => {
        if (!this.active) return;
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        if (newText) processChunk(newText);
      };

      xhr.onload = () => {
        const newText = xhr.responseText.slice(processedLength);
        if (newText) processChunk(newText);
        if (this.active) {
          this.active = false;
          resolve();
        }
      };

      xhr.onerror = () => {
        this.active = false;
        onError("Network error - could not reach the scan server.");
        resolve();
      };

      xhr.send();
    });
  }

  /** Client-side cancel - aborts the XHR so the server detects disconnect. */
  cancel() {
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }
    this.active = false;
  }

  get isActive() {
    return this.active;
  }
}

/** Singleton instance */
export const fishingSpotsStream = new FishingSpotsStreamClient();
