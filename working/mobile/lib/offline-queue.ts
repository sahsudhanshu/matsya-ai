/**
 * Offline Queue Service
 * Manages pending operations when offline and syncs them when connection restores
 * Features:
 * - Exponential backoff for retries (1s, 2s, 4s)
 * - Configurable conflict resolution strategies
 * - Failed queue for operations exceeding max retries
 * - Persistent queue state in AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { toastService } from "./toast-service";
import { syncLogger } from "./sync-logger";

const QUEUE_KEY = "offline_queue";
const FAILED_QUEUE_KEY = "offline_queue_failed";
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

export type ConflictResolutionStrategy =
  | "last-write-wins"
  | "server-authoritative"
  | "merge";

export interface QueuedOperation {
  id: string;
  type:
    | "history_delete"
    | "history_create"
    | "preferences_update"
    | "profile_update"
    | "avatar_update";
  data: any;
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
  conflictStrategy?: ConflictResolutionStrategy;
  error?: string;
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private failedQueue: QueuedOperation[] = [];
  private isProcessing = false;
  private listeners: Array<(queue: QueuedOperation[]) => void> = [];
  private failedListeners: Array<(queue: QueuedOperation[]) => void> = [];

  async initialize() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        syncLogger.info("OfflineQueue", `Loaded ${this.queue.length} pending operation(s) from storage`);
        console.log(
          `[OfflineQueue] Loaded ${this.queue.length} pending operations`,
        );
      }

      const failedStored = await AsyncStorage.getItem(FAILED_QUEUE_KEY);
      if (failedStored) {
        this.failedQueue = JSON.parse(failedStored);
        if (this.failedQueue.length > 0)
          syncLogger.warn("OfflineQueue", `Loaded ${this.failedQueue.length} previously-failed operation(s) from storage`);
        console.log(
          `[OfflineQueue] Loaded ${this.failedQueue.length} failed operations`,
        );
      }
    } catch (error) {
      syncLogger.error("OfflineQueue", "Failed to load queue from storage");
      console.error("[OfflineQueue] Failed to load queue:", error);
    }
  }

  async add(
    type: QueuedOperation["type"],
    data: any,
    conflictStrategy: ConflictResolutionStrategy = "last-write-wins",
  ): Promise<void> {
    const operation: QueuedOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      conflictStrategy,
    };

    this.queue.push(operation);

    // Limit queue size
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    await this.save();
    this.notifyListeners();

    syncLogger.info("OfflineQueue", `Queued ${type} (${conflictStrategy}) - queue size: ${this.queue.length}`);
    console.log(
      `[OfflineQueue] Added ${type} operation to queue with ${conflictStrategy} strategy`,
    );
  }

  async remove(id: string): Promise<void> {
    this.queue = this.queue.filter((op) => op.id !== id);
    await this.save();
    this.notifyListeners();
  }

  async clear(): Promise<void> {
    this.queue = [];
    await this.save();
    this.notifyListeners();
  }

  async clearFailed(): Promise<void> {
    this.failedQueue = [];
    await this.saveFailed();
    this.notifyFailedListeners();
  }

  async retryFailed(id: string): Promise<void> {
    const operation = this.failedQueue.find((op) => op.id === id);
    if (operation) {
      // Reset retry count and move back to main queue
      operation.retryCount = 0;
      operation.lastAttempt = undefined;
      operation.error = undefined;
      this.queue.push(operation);
      this.failedQueue = this.failedQueue.filter((op) => op.id !== id);
      await this.save();
      await this.saveFailed();
      this.notifyListeners();
      this.notifyFailedListeners();
    }
  }

  getQueue(): QueuedOperation[] {
    return [...this.queue];
  }

  getFailedQueue(): QueuedOperation[] {
    return [...this.failedQueue];
  }

  getCount(): number {
    return this.queue.length;
  }

  getFailedCount(): number {
    return this.failedQueue.length;
  }

  subscribe(listener: (queue: QueuedOperation[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  subscribeToFailed(listener: (queue: QueuedOperation[]) => void) {
    this.failedListeners.push(listener);
    return () => {
      this.failedListeners = this.failedListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.getQueue()));
  }

  private notifyFailedListeners() {
    this.failedListeners.forEach((listener) => listener(this.getFailedQueue()));
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("[OfflineQueue] Failed to save queue:", error);
    }
  }

  private async saveFailed(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        FAILED_QUEUE_KEY,
        JSON.stringify(this.failedQueue),
      );
    } catch (error) {
      console.error("[OfflineQueue] Failed to save failed queue:", error);
    }
  }

  /**
   * Calculate exponential backoff delay: 1s, 2s, 4s
   */
  private calculateBackoffDelay(retryCount: number): number {
    return BASE_RETRY_DELAY * Math.pow(2, retryCount);
  }

  /**
   * Check if operation should be retried based on backoff delay
   */
  private shouldRetry(operation: QueuedOperation): boolean {
    if (!operation.lastAttempt) return true;

    const backoffDelay = this.calculateBackoffDelay(operation.retryCount);
    const timeSinceLastAttempt = Date.now() - operation.lastAttempt;

    return timeSinceLastAttempt >= backoffDelay;
  }

  async processQueue(isOnline: boolean): Promise<void> {
    if (!isOnline || this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    syncLogger.info("OfflineQueue", `Processing ${this.queue.length} queued operation(s)`);
    console.log(`[OfflineQueue] Processing ${this.queue.length} operations...`);

    const operations = [...this.queue];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const operation of operations) {
      // Check if we should retry based on exponential backoff
      if (!this.shouldRetry(operation)) {
        skippedCount++;
        continue;
      }

      try {
        // Update last attempt timestamp
        operation.lastAttempt = Date.now();

        syncLogger.info("OfflineQueue", `Executing ${operation.type}…`);
        // Execute with conflict resolution
        await this.executeOperation(operation);

        // Success - remove from queue
        await this.remove(operation.id);
        syncLogger.success("OfflineQueue", `✔ ${operation.type} complete`);
        successCount++;
      } catch (error) {
        console.error(
          `[OfflineQueue] Failed to execute ${operation.type}:`,
          error,
        );

        // Increment retry count
        operation.retryCount++;
        operation.error =
          error instanceof Error ? error.message : "Unknown error";

        // Move to failed queue if max retries exceeded
        if (operation.retryCount >= MAX_RETRIES) {
          console.warn(
            `[OfflineQueue] Max retries exceeded for ${operation.id}, moving to failed queue`,
          );
          syncLogger.error("OfflineQueue", `✘ ${operation.type} exceeded max retries - moved to failed queue`);
          this.failedQueue.push(operation);
          await this.remove(operation.id);
          await this.saveFailed();
          this.notifyFailedListeners();
          failCount++;
        } else {
          const msg = error instanceof Error ? error.message : String(error);
          syncLogger.warn("OfflineQueue", `✘ ${operation.type} failed (attempt ${operation.retryCount}/${MAX_RETRIES}): ${msg}`);
          // Save updated retry count and last attempt
          await this.save();
        }
      }
    }

    this.isProcessing = false;

    if (successCount > 0) {
      toastService.success(
        `Synced ${successCount} pending change${successCount > 1 ? "s" : ""}`,
      );
    }

    if (failCount > 0) {
      toastService.warning(
        `${failCount} operation${failCount > 1 ? "s" : ""} failed after ${MAX_RETRIES} attempts`,
      );
    }

    syncLogger.info("OfflineQueue", `Done: ${successCount} ✔  ${failCount} ✘  ${skippedCount} deferred (backoff)`);
    console.log(
      `[OfflineQueue] Processing complete: ${successCount} success, ${failCount} failed, ${skippedCount} skipped (backoff)`,
    );
  }

  /**
   * Apply conflict resolution strategy
   */
  private async resolveConflict(
    operation: QueuedOperation,
    serverData: any,
  ): Promise<any> {
    const strategy = operation.conflictStrategy || "last-write-wins";

    switch (strategy) {
      case "last-write-wins":
        // Client data always wins
        return operation.data;

      case "server-authoritative":
        // Server data always wins - skip this operation
        console.log(
          `[OfflineQueue] Server-authoritative: skipping ${operation.id}`,
        );
        return null;

      case "merge":
        // Merge client and server data
        return {
          ...serverData,
          ...operation.data,
        };

      default:
        return operation.data;
    }
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    const {
      deleteGroup,
      updateUserPreferences,
      updateUserProfile,
      updateAvatarUrl,
      getUserProfile,
      getUserPreferences,
    } = await import("./api-client");

    switch (operation.type) {
      case "history_delete":
        await deleteGroup(operation.data.groupId);
        break;

      case "preferences_update": {
        // Apply conflict resolution for preferences
        if (operation.conflictStrategy === "merge") {
          try {
            const serverPrefs = await getUserPreferences();
            const mergedData = await this.resolveConflict(
              operation,
              serverPrefs,
            );
            if (mergedData) {
              await updateUserPreferences(mergedData);
            }
          } catch (error) {
            // If can't fetch server data, use client data
            await updateUserPreferences(operation.data);
          }
        } else {
          const resolvedData = await this.resolveConflict(operation, null);
          if (resolvedData) {
            await updateUserPreferences(resolvedData);
          }
        }
        break;
      }

      case "profile_update": {
        // Apply conflict resolution for profile
        if (operation.conflictStrategy === "merge") {
          try {
            const serverProfile = await getUserProfile();
            const mergedData = await this.resolveConflict(
              operation,
              serverProfile,
            );
            if (mergedData) {
              await updateUserProfile(mergedData);
            }
          } catch (error) {
            // If can't fetch server data, use client data
            await updateUserProfile(operation.data);
          }
        } else {
          const resolvedData = await this.resolveConflict(operation, null);
          if (resolvedData) {
            await updateUserProfile(resolvedData);
          }
        }
        break;
      }

      case "avatar_update":
        await updateAvatarUrl(operation.data.avatarUrl);
        break;

      case "history_create":
        // History creation is handled by the upload flow
        // This is just for tracking purposes
        break;

      default:
        console.warn(
          `[OfflineQueue] Unknown operation type: ${operation.type}`,
        );
    }
  }
}

export const offlineQueue = new OfflineQueue();
