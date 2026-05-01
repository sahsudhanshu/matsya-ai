/**
 * Sync Status Indicator
 * Shows sync status with icon and manual sync button
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../../lib/network-context";
import { toastService } from "../../lib/toast-service";

interface SyncStatusIndicatorProps {
  showLabel?: boolean;
  size?: "small" | "medium";
}

export function SyncStatusIndicator({
  showLabel = false,
  size = "medium",
}: SyncStatusIndicatorProps) {
  const {
    syncStatus,
    pendingCount,
    failedCount,
    lastSyncTime,
    manualSync,
    isOnline,
  } = useNetwork();

  // Tick every minute so the "Xm ago" text stays current
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      toastService.error("No internet connection");
      return;
    }
    try {
      await manualSync();
      toastService.success("Sync completed");
    } catch {
      toastService.error("Sync failed");
    }
  };

  const getStatusConfig = () => {
    // Actively syncing
    if (syncStatus === "syncing") {
      return {
        icon: null,
        color: "#3B82F6",
        text: "Syncing...",
        showSpinner: true,
      };
    }

    // Offline with queued items - no spinner, show saved-offline badge
    if (!isOnline && pendingCount > 0) {
      return {
        icon: "cloud-offline" as const,
        color: "#F59E0B",
        text: `${pendingCount} saved`,
        showSpinner: false,
      };
    }

    // Actually-failed items (not just a transient syncStatus)
    if (failedCount > 0) {
      return {
        icon: "alert-circle" as const,
        color: "#EF4444",
        text: `${failedCount} failed`,
        showSpinner: false,
      };
    }

    // Pending items waiting to upload
    if (pendingCount > 0) {
      return {
        icon: "cloud-upload" as const,
        color: "#F59E0B",
        text: `${pendingCount} pending`,
        showSpinner: false,
      };
    }

    // Successfully synced - show relative time
    if ((syncStatus === "synced" || syncStatus === "idle") && lastSyncTime) {
      const minutes = Math.floor(
        (Date.now() - lastSyncTime.getTime()) / 60_000,
      );
      return {
        icon: "checkmark-circle" as const,
        color: "#10B981",
        text: minutes > 0 ? `${minutes}m ago` : "Just now",
        showSpinner: false,
      };
    }

    // Idle - nothing pending, never synced this session
    return {
      icon: "cloud-done" as const,
      color: "#6B7280",
      text: "Synced",
      showSpinner: false,
    };
  };

  const config = getStatusConfig();
  const iconSize = size === "small" ? 16 : 20;
  const fontSize = size === "small" ? 12 : 14;

  // Only allow manual sync tap when online and there are pending items
  const showSyncButton =
    isOnline && pendingCount > 0 && syncStatus !== "syncing";

  return (
    <TouchableOpacity
      className="px-2 py-1"
      onPress={showSyncButton ? handleManualSync : undefined}
      disabled={!showSyncButton}
    >
      <View className="flex-row items-center gap-1.5">
        {config.showSpinner ? (
          <ActivityIndicator size="small" color={config.color} />
        ) : (
          config.icon && (
            <Ionicons name={config.icon} size={iconSize} color={config.color} />
          )
        )}
        {showLabel && (
          <Text style={{ color: config.color, fontWeight: "500", fontSize }}>
            {config.text}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
