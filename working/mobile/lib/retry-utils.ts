/**
 * Retry utilities for API calls with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  onRetry: () => {},
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter (±25% randomness) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, cappedDelay + jitter);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableStatuses: number[]): boolean {
  // Network errors (no response)
  if (!error.status && error.message?.includes("network")) {
    return true;
  }

  // Timeout errors
  if (error.message?.includes("timeout")) {
    return true;
  }

  // Specific HTTP status codes
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if this is the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Don't retry if error is not retryable
      if (!isRetryableError(error, opts.retryableStatuses)) {
        throw error;
      }

      // Calculate delay and notify
      const delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
      );

      opts.onRetry(attempt + 1, error);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError!;
}

/**
 * Retry configuration presets for different scenarios
 */
export const RETRY_PRESETS = {
  // Fast retry for quick operations (3 retries, 1s, 2s, 4s)
  FAST: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 4000,
    backoffMultiplier: 2,
  },

  // Standard retry for most operations (3 retries, 2s, 4s, 8s)
  STANDARD: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 8000,
    backoffMultiplier: 2,
  },

  // Slow retry for heavy operations (5 retries, 3s, 6s, 12s, 24s, 30s)
  SLOW: {
    maxRetries: 5,
    initialDelayMs: 3000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },

  // No retry for operations that should fail fast
  NONE: {
    maxRetries: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
  },
} as const;
