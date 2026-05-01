import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { COLORS } from "../../lib/constants";
import { Card } from "../ui/Card";
import { SyncService, type SyncStatus } from "../../lib/sync-service";
import { toastService } from "../../lib/toast-service";

export function SyncStatusCard() {
  const [status, setStatus] = useState<SyncStatus>({
    pending: 0,
    failed: 0,
    syncing: false,
    syncStatus: "idle",
  });

  useEffect(() => {
    loadStatus();
    const unsubscribe = SyncService.subscribe(setStatus);
    return unsubscribe;
  }, []);

  const loadStatus = async () => {
    const currentStatus = await SyncService.getSyncStatus();
    setStatus(currentStatus);
  };

  const handleSyncNow = async () => {
    if (status.pending === 0) {
      toastService.info("Data is already up to date.");
      // Still trigger a background check just in case
      SyncService.syncPendingChanges();
      return;
    }

    try {
      toastService.info("Syncing your data...");
      await SyncService.syncPendingChanges();
      await loadStatus();
      toastService.success("Sync completed successfully!");
    } catch (error) {
      console.error("Sync failed:", error);
      toastService.error("Sync failed. Please try again.");
    }
  };

  const getStatusText = () => {
    if (status.syncing) return "Syncing...";
    if (status.pending > 0) return `${status.pending} pending`;
    if (status.failed > 0) return `${status.failed} failed`;
    return "Synced";
  };

  const getStatusColor = () => {
    if (status.syncing) return COLORS.primary;
    if (status.pending > 0) return COLORS.warning;
    if (status.failed > 0) return COLORS.error;
    return COLORS.success;
  };

  const formatLastSync = () => {
    if (!status.lastSync) return "Never";
    const date = new Date(status.lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="mb-sm">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <View className="flex-row items-center gap-sm mb-xs">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStatusColor() }}
            />
            <Text className="text-sm text-textPrimary font-medium">{getStatusText()}</Text>
          </View>
          <Text className="text-xs text-textSubtle">Last sync: {formatLastSync()}</Text>
        </View>

        <TouchableOpacity
          className={`bg-primary/15 border border-primary/40 rounded-md px-sm py-[5px] ${status.syncing ? "opacity-50" : ""}`}
          onPress={handleSyncNow}
          disabled={status.syncing}
        >
          {status.syncing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text className="text-xs text-primary font-semibold">Sync Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}
