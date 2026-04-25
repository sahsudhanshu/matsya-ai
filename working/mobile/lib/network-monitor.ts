/**
 * Network Monitor
 * Monitors network status and notifies users about feature availability
 */

import { toastService } from "./toast-service";
import { offlineQueue } from "./offline-queue";

class NetworkMonitor {
  private wasOnline: boolean = true;
  private hasShownOfflineToast: boolean = false;
  private hasShownOnlineToast: boolean = false;

  /**
   * Handle network status change
   */
  async onNetworkChange(isOnline: boolean, connectionQuality: string) {
    // Network went offline
    if (!isOnline && this.wasOnline) {
      this.wasOnline = false;
      this.hasShownOfflineToast = true;
      this.hasShownOnlineToast = false;

      toastService.warning("You are offline. Limited features available.");

      // Show what features are unavailable
      setTimeout(() => {
        toastService.info("Offline mode: Using local AI models for analysis");
      }, 2000);
    }

    // Network came back online
    if (isOnline && !this.wasOnline) {
      this.wasOnline = true;
      this.hasShownOnlineToast = true;
      this.hasShownOfflineToast = false;

      toastService.success("Back online! Syncing pending changes...");

      // Process offline queue
      try {
        await offlineQueue.processQueue(true);
      } catch (error) {
        console.error("[NetworkMonitor] Failed to process queue:", error);
      }
    }

    // Poor connection quality
    if (
      isOnline &&
      connectionQuality === "poor" &&
      !this.hasShownOfflineToast
    ) {
      toastService.warning(
        "Slow connection detected. Using offline mode for better performance.",
      );
      this.hasShownOfflineToast = true;
    }
  }

  /**
   * Show feature unavailable toast
   */
  showFeatureUnavailable(featureName: string) {
    toastService.warning(`${featureName} requires internet connection`);
  }

  /**
   * Show offline features available
   */
  showOfflineFeaturesAvailable() {
    const features = [
      "✓ Fish detection (local AI)",
      "✓ Species identification",
      "✓ Disease detection",
      "✓ View history (cached)",
    ];

    toastService.info("Offline features:\n" + features.join("\n"));
  }

  /**
   * Show online-only features
   */
  showOnlineOnlyFeatures() {
    const features = [
      "✗ Cloud analysis",
      "✗ Chat assistant",
      "✗ Live weather",
      "✗ Market prices",
      "✗ Profile sync",
    ];

    toastService.info("Online-only features:\n" + features.join("\n"));
  }

  /**
   * Check if feature is available offline
   */
  isFeatureAvailableOffline(feature: string): boolean {
    const offlineFeatures = [
      "detection",
      "species",
      "disease",
      "history_view",
      "camera",
      "gallery",
    ];

    return offlineFeatures.includes(feature);
  }

  /**
   * Show appropriate message when trying to use online-only feature
   */
  handleOnlineOnlyFeature(featureName: string, isOnline: boolean) {
    if (!isOnline) {
      toastService.warning(`${featureName} is not available offline`);
      return false;
    }
    return true;
  }
}

export const networkMonitor = new NetworkMonitor();
