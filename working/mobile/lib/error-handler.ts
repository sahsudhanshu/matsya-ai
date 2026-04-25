/**
 * Global Error Handler
 * Handles unauthorized errors and redirects to login
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { toastService } from "./toast-service";

const TOKEN_KEY = "ocean_ai_token";
const USER_KEY = "ocean_ai_user";

let isHandlingUnauthorized = false;

type ErrorWithStatus = {
  status?: unknown;
};

export async function handleUnauthorizedError() {
  // Prevent multiple simultaneous logout attempts
  if (isHandlingUnauthorized) {
    return;
  }

  isHandlingUnauthorized = true;

  try {
    // Show toast notification
    toastService.error("Session expired. Please login again.");

    // Clear stored credentials
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);

    // Small delay to ensure toast is visible
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Redirect to login
    router.replace("/auth/login");
  } catch (error) {
    console.error("Error handling unauthorized:", error);
  } finally {
    // Reset flag after a delay to allow for new unauthorized errors
    setTimeout(() => {
      isHandlingUnauthorized = false;
    }, 1000);
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as ErrorWithStatus).status;
    return typeof status === "number" && status === 401;
  }
  return false;
}

export async function handleApiError(error: unknown) {
  if (isUnauthorizedError(error)) {
    await handleUnauthorizedError();
    throw error; // Re-throw to let caller know the error occurred
  }
  throw error;
}
