/**
 * Component loading utilities with error handling and retry logic
 * Requirements: 4.6, 4.7, 20.1
 */

import type { ComponentType } from '@/types/agent-first';

// ── Loading Configuration ─────────────────────────────────────────────────────

const MAX_LOADING_TIME = 2000; // 2 seconds max loading time
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
const MAX_RETRIES = RETRY_DELAYS.length;

// ── Loading State Types ───────────────────────────────────────────────────────

export interface LoadingState {
  isLoading: boolean;
  progress: number; // 0-100
  error: Error | null;
  retryCount: number;
}

export interface LoadResult {
  success: boolean;
  error?: Error;
  retryCount: number;
}

// ── Component Loader Class ────────────────────────────────────────────────────

export class ComponentLoader {
  private loadingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Load a component with timeout and retry logic
   * @param component - Component type to load
   * @param loadFn - Function that performs the actual loading
   * @param onProgress - Callback for progress updates
   * @param onError - Callback for errors
   * @returns Promise that resolves when loading completes or fails
   */
  async loadComponent(
    component: ComponentType,
    loadFn: () => Promise<void>,
    onProgress?: (progress: number) => void,
    onError?: (error: Error) => void
  ): Promise<LoadResult> {
    if (!component) {
      return { success: false, error: new Error('Invalid component'), retryCount: 0 };
    }

    return this.loadWithRetry(component, loadFn, 0, onProgress, onError);
  }

  /**
   * Internal method to load with retry logic
   */
  private async loadWithRetry(
    component: ComponentType,
    loadFn: () => Promise<void>,
    retryCount: number,
    onProgress?: (progress: number) => void,
    onError?: (error: Error) => void
  ): Promise<LoadResult> {
    try {
      // Start loading with timeout
      const result = await this.loadWithTimeout(component, loadFn, onProgress);
      
      if (result.success) {
        return { success: true, retryCount };
      }

      // Loading failed - attempt retry if retries remaining
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        
        if (onError) {
          onError(new Error(`Loading failed. Retrying in ${delay / 1000}s...`));
        }

        // Wait for retry delay
        await this.delay(delay);

        // Retry
        return this.loadWithRetry(component, loadFn, retryCount + 1, onProgress, onError);
      }

      // Max retries exceeded
      const error = new Error(`Failed to load ${component} after ${MAX_RETRIES} retries`);
      if (onError) {
        onError(error);
      }

      return { success: false, error, retryCount };

    } catch (error) {
      // Unexpected error
      const err = error instanceof Error ? error : new Error(String(error));
      
      if (onError) {
        onError(err);
      }

      return { success: false, error: err, retryCount };
    }
  }

  /**
   * Load with timeout
   */
  private async loadWithTimeout(
    component: ComponentType,
    loadFn: () => Promise<void>,
    onProgress?: (progress: number) => void
  ): Promise<LoadResult> {
    return new Promise((resolve) => {
      let completed = false;

      // Progress simulation (0% -> 90% over loading time)
      const progressInterval = setInterval(() => {
        if (completed) {
          clearInterval(progressInterval);
          return;
        }

        const elapsed = Date.now() - startTime;
        const progress = Math.min(90, (elapsed / MAX_LOADING_TIME) * 90);
        
        if (onProgress) {
          onProgress(Math.round(progress));
        }
      }, 100);

      // Timeout handler
      const timeoutId = setTimeout(() => {
        if (!completed) {
          completed = true;
          clearInterval(progressInterval);
          resolve({ success: false, error: new Error('Loading timeout'), retryCount: 0 });
        }
      }, MAX_LOADING_TIME);

      this.loadingTimeouts.set(component!, timeoutId);

      const startTime = Date.now();

      // Execute load function
      loadFn()
        .then(() => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            clearInterval(progressInterval);
            this.loadingTimeouts.delete(component!);

            // Complete progress to 100%
            if (onProgress) {
              onProgress(100);
            }

            resolve({ success: true, retryCount: 0 });
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            clearInterval(progressInterval);
            this.loadingTimeouts.delete(component!);

            resolve({ success: false, error, retryCount: 0 });
          }
        });
    });
  }

  /**
   * Cancel loading for a component
   */
  cancelLoading(component: ComponentType): void {
    if (!component) return;

    const timeoutId = this.loadingTimeouts.get(component);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.loadingTimeouts.delete(component);
    }

    const retryId = this.retryTimeouts.get(component);
    if (retryId) {
      clearTimeout(retryId);
      this.retryTimeouts.delete(component);
    }
  }

  /**
   * Cancel all loading operations
   */
  cancelAll(): void {
    this.loadingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.retryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.loadingTimeouts.clear();
    this.retryTimeouts.clear();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── Singleton Instance ────────────────────────────────────────────────────────

export const componentLoader = new ComponentLoader();

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Format error message for display
 */
export function formatLoadError(error: Error, retryCount: number): string {
  if (retryCount > 0) {
    return `Failed to load component after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}: ${error.message}`;
  }
  return `Failed to load component: ${error.message}`;
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
  return error.message.includes('timeout') || error.message.includes('Timeout');
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // Network errors, timeouts, and temporary failures are retryable
  return (
    isTimeoutError(error) ||
    error.message.includes('network') ||
    error.message.includes('Network') ||
    error.message.includes('fetch') ||
    error.message.includes('ECONNREFUSED')
  );
}
