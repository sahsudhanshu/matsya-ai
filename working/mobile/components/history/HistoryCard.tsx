import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../ui/Card";
import type { GroupRecord } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface HistoryCardProps {
  group: GroupRecord;
  onViewDetails: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onExportPDF: () => void;
  /** Present only for locally-saved offline records not yet synced to the cloud */
  offlineSyncStatus?: "pending" | "failed";
}

export function HistoryCard({
  group,
  onViewDetails,
  onDelete,
  onAskAI,
  onExportPDF,
  offlineSyncStatus,
}: HistoryCardProps) {
  const statusColors: Record<string, string> = {
    completed: COLORS.success,
    processing: COLORS.primary,
    partial: COLORS.warning,
    failed: COLORS.error,
  };

  const statusColor = statusColors[group.status] || COLORS.textMuted;

  const handleDelete = () => {
    Alert.alert(
      "Delete Analysis",
      "Are you sure you want to delete this analysis? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  const imageCount = group.imageCount || 0;
  const fishCount = group.analysisResult?.aggregateStats?.totalFishCount || 0;
  const speciesCount = group.analysisResult?.aggregateStats?.speciesDistribution
    ? Object.keys(group.analysisResult.aggregateStats.speciesDistribution)
        .length
    : 0;
  const totalWeight =
    group.analysisResult?.aggregateStats?.totalEstimatedWeight;
  const totalValue = group.analysisResult?.aggregateStats?.totalEstimatedValue;
  const hasDiseases =
    group.analysisResult?.aggregateStats?.diseaseDetected ||
    group.analysisResult?.detections?.some(
      (d) => d.diseaseStatus !== "Healthy",
    ) ||
    false;

  const hasImages =
    group.presignedViewUrls && group.presignedViewUrls.length > 0;
  const previewUrls = group.presignedViewUrls?.slice(0, 3) || [];

  return (
    <Card variant="default" padding={0} style={styles.cardContainer}>
      {/* Thumbnail Row or Placeholder */}
      {hasImages ? (
        <View style={styles.thumbnailRow}>
          {previewUrls.map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={[
                styles.thumbnail,
                previewUrls.length === 1 && styles.thumbnailFull,
                previewUrls.length === 2 && styles.thumbnailHalf,
                previewUrls.length >= 3 && styles.thumbnailThird,
              ]}
              resizeMode="cover"
            />
          ))}
          {imageCount > 3 && (
            <View style={styles.moreOverlay}>
              <Text style={styles.moreText}>+{imageCount - 3}</Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.placeholderRow}
          onPress={onViewDetails}
          activeOpacity={0.8}
        >
          <View style={styles.placeholderLeft}>
            <Ionicons
              name="images-outline"
              size={28}
              color={COLORS.textMuted}
            />
            <View>
              <Text style={styles.placeholderCount}>
                {imageCount} {imageCount === 1 ? "image" : "images"}
              </Text>
              <Text style={styles.placeholderSub}>Tap to view analysis</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}

      {/* Info Section */}
      <View style={styles.infoSection}>
        {/* Header row: date + status badge */}
        <View style={styles.headerRow}>
          <Text style={styles.date}>
            {new Date(group.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + "22" },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Offline sync badge */}
        {offlineSyncStatus && (
          <View
            style={[
              styles.syncBadge,
              {
                backgroundColor:
                  offlineSyncStatus === "pending"
                    ? COLORS.warning + "22"
                    : COLORS.error + "22",
              },
            ]}
          >
            <Ionicons
              name={
                offlineSyncStatus === "pending"
                  ? "cloud-upload-outline"
                  : "cloud-offline-outline"
              }
              size={11}
              color={
                offlineSyncStatus === "pending" ? COLORS.warning : COLORS.error
              }
            />
            <Text
              style={[
                styles.syncBadgeText,
                {
                  color:
                    offlineSyncStatus === "pending"
                      ? COLORS.warning
                      : COLORS.error,
                },
              ]}
            >
              {offlineSyncStatus === "pending"
                ? "Saved Offline · Pending Sync"
                : "Sync Failed · Will Retry"}
            </Text>
          </View>
        )}

        {/* Stats row */}
        {group.status === "completed" && (
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Ionicons name="fish" size={13} color={COLORS.primary} />
              <Text style={styles.statChipText}>{fishCount} fish</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="list" size={13} color={COLORS.secondary} />
              <Text style={styles.statChipText}>{speciesCount} species</Text>
            </View>
            {totalWeight != null && totalWeight > 0 && (
              <View style={styles.statChip}>
                <Ionicons
                  name="scale-outline"
                  size={13}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.statChipText}>
                  {totalWeight.toFixed(1)} kg
                </Text>
              </View>
            )}
            {hasDiseases && (
              <View
                style={[
                  styles.statChip,
                  { backgroundColor: COLORS.error + "18" },
                ]}
              >
                <Ionicons name="warning" size={13} color={COLORS.error} />
                <Text style={[styles.statChipText, { color: COLORS.error }]}>
                  Disease
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={onViewDetails}
          >
            <Ionicons name="eye-outline" size={15} color={COLORS.bgDark} />
            <Text style={styles.primaryActionText}>View Details</Text>
          </TouchableOpacity>

          {group.status === "completed" && !offlineSyncStatus && (
            <TouchableOpacity style={styles.iconAction} onPress={onAskAI}>
              <Ionicons
                name="chatbubble-outline"
                size={15}
                color={COLORS.primaryLight}
              />
            </TouchableOpacity>
          )}

          {group.status === "completed" && !offlineSyncStatus && (
            <TouchableOpacity style={styles.iconAction} onPress={onExportPDF}>
              <Ionicons
                name="document-outline"
                size={15}
                color={COLORS.primaryLight}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.iconAction} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={15} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  thumbnailRow: {
    flexDirection: "row",
    height: 140,
    overflow: "hidden",
  },
  thumbnail: {
    height: "100%",
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  thumbnailFull: {
    width: "100%",
  },
  thumbnailHalf: {
    width: "50%",
  },
  thumbnailThird: {
    width: "33.33%",
  },
  moreOverlay: {
    position: "absolute",
    right: 0,
    top: 0,
    width: "33.33%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  placeholderRow: {
    height: 60,
    backgroundColor: COLORS.bgSurface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  placeholderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  placeholderCount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
  },
  placeholderSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  infoSection: {
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  syncBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statChipText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.xs,
    alignItems: "center",
  },
  primaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  primaryActionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.bgDark,
  },
  iconAction: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
