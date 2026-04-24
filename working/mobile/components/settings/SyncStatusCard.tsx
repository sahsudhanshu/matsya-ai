import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
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
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.statusRow}>
            <View
              style={[styles.indicator, { backgroundColor: getStatusColor() }]}
            />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
          <Text style={styles.lastSync}>Last sync: {formatLastSync()}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, status.syncing && styles.buttonDisabled]}
          onPress={handleSyncNow}
          disabled={status.syncing}
        >
          {status.syncing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.buttonText}>Sync Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.medium,
  },
  lastSync: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
  },
  button: {
    backgroundColor: COLORS.primary + "15",
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  buttonText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
