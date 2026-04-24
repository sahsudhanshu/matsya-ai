/**
 * Notification Service for Disaster Alerts
 *
 * Handles push notifications for nearby disaster alerts:
 * - Request notification permissions
 * - Subscribe to alert notifications
 * - Show local notification when critical alert is nearby
 * - Handle notification tap to open map
 *
 * Requirements: 3.2
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DisasterAlert } from "./alerts";
import { computeSafetyStatus } from "./alerts";

const NOTIFICATION_PREFS_KEY = "@notifications/disaster_alerts_enabled";
const LAST_ALERT_KEY = "@notifications/last_alert_id";
const NOTIFICATION_DISTANCE_THRESHOLD_KM = 100; // Notify if within 100km

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the user
 * Handles both iOS and Android permission flows
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Notification permissions not granted");
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("disaster-alerts", {
        name: "Disaster Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF4D4F",
        sound: "default",
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });
    }

    return true;
  } catch (error) {
    console.error("Failed to request notification permissions:", error);
    return false;
  }
}

/**
 * Check if disaster alert notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    return enabled === "true";
  } catch (error) {
    console.error("Failed to check notification preferences:", error);
    return false;
  }
}

/**
 * Enable or disable disaster alert notifications
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NOTIFICATION_PREFS_KEY,
      enabled ? "true" : "false",
    );
  } catch (error) {
    console.error("Failed to save notification preferences:", error);
  }
}

/**
 * Calculate distance between two coordinates in kilometers
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get the last notified alert ID to prevent duplicate notifications
 */
async function getLastAlertId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_ALERT_KEY);
  } catch (error) {
    console.error("Failed to get last alert ID:", error);
    return null;
  }
}

/**
 * Save the last notified alert ID
 */
async function setLastAlertId(alertId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ALERT_KEY, alertId);
  } catch (error) {
    console.error("Failed to save last alert ID:", error);
  }
}

/**
 * Check for nearby critical alerts and send notification if needed
 *
 * @param alerts - List of active disaster alerts
 * @param userLocation - User's current location
 * @returns true if notification was sent, false otherwise
 */
export async function checkAndNotifyNearbyAlerts(
  alerts: DisasterAlert[],
  userLocation: { latitude: number; longitude: number } | null,
): Promise<boolean> {
  if (!userLocation) {
    return false;
  }

  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled();
  if (!enabled) {
    return false;
  }

  // Check permissions
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    return false;
  }

  // Filter for critical alerts within threshold distance
  const now = Date.now();
  const nearbyAlerts = alerts.filter((alert) => {
    // Skip expired alerts
    if (new Date(alert.expiresAt).getTime() < now) {
      return false;
    }

    // Calculate distance to alert
    const distance = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      alert.lat,
      alert.lng,
    );

    // Only notify for critical/high severity alerts within threshold
    const isCritical = alert.severity === "red" || alert.severity === "orange";
    const isNearby = distance <= NOTIFICATION_DISTANCE_THRESHOLD_KM;

    return isCritical && isNearby;
  });

  if (nearbyAlerts.length === 0) {
    return false;
  }

  // Get the most severe alert
  const criticalAlert = nearbyAlerts.sort((a, b) => {
    const severityOrder: Record<string, number> = {
      red: 0,
      orange: 1,
      yellow: 2,
    };
    return severityOrder[a.severity] - severityOrder[b.severity];
  })[0];

  // Check if we already notified about this alert
  const lastAlertId = await getLastAlertId();
  if (lastAlertId === criticalAlert.id) {
    return false;
  }

  // Calculate distance for notification message
  const distance = haversineDistance(
    userLocation.latitude,
    userLocation.longitude,
    criticalAlert.lat,
    criticalAlert.lng,
  );

  // Determine safety status
  const safetyStatus = computeSafetyStatus(
    userLocation.latitude,
    userLocation.longitude,
    alerts,
  );

  // Send notification
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${criticalAlert.severity === "red" ? "CRITICAL" : "HIGH"} Alert Nearby`,
        body: `${criticalAlert.title}\n${distance.toFixed(0)}km from your location. ${safetyStatus === "UNSAFE" ? "You are in the affected area!" : "Stay informed."}`,
        data: {
          alertId: criticalAlert.id,
          type: "disaster_alert",
          screen: "map",
          severity: criticalAlert.severity,
        },
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        badge: 1,
      },
      trigger: null, // Send immediately
    });

    // Save this alert ID to prevent duplicate notifications
    await setLastAlertId(criticalAlert.id);

    console.log("Disaster alert notification sent:", criticalAlert.title);
    return true;
  } catch (error) {
    console.error("Failed to send disaster alert notification:", error);
    return false;
  }
}

/**
 * Set up notification response listener
 * Handles when user taps on a notification
 *
 * @param onNotificationTap - Callback function to handle notification tap
 * @returns Subscription object to remove listener
 */
export function setupNotificationListener(
  onNotificationTap: (alertId: string) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (data && data.type === "disaster_alert" && data.alertId) {
      console.log("User tapped disaster alert notification:", data.alertId);
      onNotificationTap(data.alertId as string);
    }
  });
}

/**
 * Clear all disaster alert notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error("Failed to clear notifications:", error);
  }
}

/**
 * Get notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error("Failed to get badge count:", error);
    return 0;
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("Failed to set badge count:", error);
  }
}

/**
 * Initialize notification service
 * Should be called when app starts
 */
export async function initializeNotificationService(): Promise<void> {
  try {
    // Request permissions on first launch
    const enabled = await areNotificationsEnabled();
    if (enabled === null) {
      // First time - request permissions
      const granted = await requestNotificationPermissions();
      await setNotificationsEnabled(granted);
    }

    // Clear badge on app open
    await setBadgeCount(0);
  } catch (error) {
    console.error("Failed to initialize notification service:", error);
  }
}
