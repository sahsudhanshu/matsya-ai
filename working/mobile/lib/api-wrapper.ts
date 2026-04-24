/**
 * API Wrapper with comprehensive error handling and toast notifications
 * Wraps all API calls to provide consistent error handling and user feedback
 */

import { toastService } from "./toast-service";
import { offlineQueue } from "./offline-queue";
import { ApiError } from "./api-client";

export interface ApiCallOptions {
  showSuccessToast?: boolean;
  successMessage?: string;
  showErrorToast?: boolean;
  errorMessage?: string;
  queueOffline?: boolean;
  queueType?:
    | "history_delete"
    | "history_create"
    | "preferences_update"
    | "profile_update"
    | "avatar_update";
  silent?: boolean; // Don't show any toasts
}

/**
 * Wraps an API call with error handling and toast notifications
 */
export async function withErrorHandling<T>(
  apiCall: () => Promise<T>,
  options: ApiCallOptions = {},
): Promise<T> {
  const {
    showSuccessToast = false,
    successMessage,
    showErrorToast = true,
    errorMessage,
    queueOffline = false,
    queueType,
    silent = false,
  } = options;

  try {
    const result = await apiCall();

    if (!silent && showSuccessToast && successMessage) {
      toastService.success(successMessage);
    }

    return result;
  } catch (error) {
    console.error("[API] Error:", error);

    // Handle offline errors
    if (error instanceof ApiError && error.status === 0) {
      if (!silent) {
        toastService.warning(
          "You are offline. Changes will sync when connection restores.",
        );
      }

      // Queue for offline sync if requested
      if (queueOffline && queueType) {
        // Extract data from the error context if available
        await offlineQueue.add(queueType, {});
      }

      throw error;
    }

    // Handle authentication errors
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      if (!silent && showErrorToast) {
        toastService.error(
          errorMessage || "Session expired. Please log in again.",
        );
      }
      throw error;
    }

    // Handle other API errors
    if (error instanceof ApiError) {
      const message = errorMessage || error.message || "An error occurred";
      if (!silent && showErrorToast) {
        toastService.error(message);
      }
      throw error;
    }

    // Handle network errors
    if (
      error instanceof Error &&
      error.message.includes("Network request failed")
    ) {
      if (!silent) {
        toastService.warning("Network error. Please check your connection.");
      }
      throw error;
    }

    // Handle unknown errors
    const message = errorMessage || "An unexpected error occurred";
    if (!silent && showErrorToast) {
      toastService.error(message);
    }

    throw error;
  }
}

/**
 * Specific wrappers for common operations
 */

export async function withLoginHandling<T>(
  apiCall: () => Promise<T>,
  successMessage: string = "Login successful",
): Promise<T> {
  return withErrorHandling(apiCall, {
    showSuccessToast: true,
    successMessage,
    errorMessage: "Login failed. Please check your credentials.",
  });
}

export async function withRegisterHandling<T>(
  apiCall: () => Promise<T>,
): Promise<T> {
  return withErrorHandling(apiCall, {
    showSuccessToast: true,
    successMessage: "Account created successfully!",
    errorMessage: "Registration failed. Please try again.",
  });
}

export async function withUploadHandling<T>(
  apiCall: () => Promise<T>,
): Promise<T> {
  return withErrorHandling(apiCall, {
    showSuccessToast: true,
    successMessage: "Upload successful",
    errorMessage: "Upload failed. Please try again.",
  });
}

export async function withAnalysisHandling<T>(
  apiCall: () => Promise<T>,
): Promise<T> {
  return withErrorHandling(apiCall, {
    showSuccessToast: false,
    errorMessage: "Analysis failed. Using offline mode.",
  });
}

export async function withDeleteHandling<T>(
  apiCall: () => Promise<T>,
  itemName: string = "item",
): Promise<T> {
  return withErrorHandling(apiCall, {
    showSuccessToast: true,
    successMessage: `${itemName} deleted successfully`,
    errorMessage: `Failed to delete ${itemName}`,
    queueOffline: true,
    queueType: "history_delete",
  });
}

export async function withUpdateHandling<T>(
  apiCall: () => Promise<T>,
  itemName: string = "item",
): Promise<T> {
  return withErrorHandling(apiCall, {
    showSuccessToast: true,
    successMessage: `${itemName} updated successfully`,
    errorMessage: `Failed to update ${itemName}`,
  });
}

export async function withSilentFetch<T>(
  apiCall: () => Promise<T>,
): Promise<T> {
  return withErrorHandling(apiCall, {
    silent: true,
    showErrorToast: false,
  });
}
