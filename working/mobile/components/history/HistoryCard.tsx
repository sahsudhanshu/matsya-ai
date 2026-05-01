import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "../../lib/constants";
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
    <Card variant="default" padding={0} className="mb-md overflow-hidden">
      {/* Thumbnail Row or Placeholder */}
      {hasImages ? (
        <View className="flex-row h-[140px] overflow-hidden">
          {previewUrls.map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              className={`h-full border-[0.5px] border-borderDark ${
                previewUrls.length === 1
                  ? "w-full"
                  : previewUrls.length === 2
                  ? "w-1/2"
                  : "w-1/3"
              }`}
              resizeMode="cover"
            />
          ))}
          {imageCount > 3 && (
            <View className="absolute right-0 top-0 w-1/3 h-full bg-black/55 justify-center items-center">
              <Text className="text-textPrimary text-md font-bold">+{imageCount - 3}</Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          className="h-[60px] bg-bgSurface flex-row items-center justify-between px-md border-b border-borderDark"
          onPress={onViewDetails}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center gap-sm">
            <Ionicons
              name="images-outline"
              size={28}
              color={COLORS.textMuted}
            />
            <View>
              <Text className="text-sm font-semibold text-textSecondary">
                {imageCount} {imageCount === 1 ? "image" : "images"}
              </Text>
              <Text className="text-xs text-textMuted mt-[1px]">Tap to view analysis</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}

      {/* Info Section */}
      <View className="p-sm gap-sm">
        {/* Header row: date + status badge */}
        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-textMuted flex-1">
            {new Date(group.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <View
            className="flex-row items-center gap-1 rounded-full px-sm py-[3px]"
            style={{ backgroundColor: statusColor + "22" }}
          >
            <View
              className="w-[6px] h-[6px] rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <Text className="text-xs font-semibold" style={{ color: statusColor }}>
              {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Offline sync badge */}
        {offlineSyncStatus && (
          <View
            className="flex-row items-center gap-1 rounded-sm px-sm py-[3px] self-start"
            style={{
              backgroundColor:
                offlineSyncStatus === "pending"
                  ? COLORS.warning + "22"
                  : COLORS.error + "22",
            }}
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
              className="text-xs font-semibold"
              style={{
                color:
                  offlineSyncStatus === "pending"
                    ? COLORS.warning
                    : COLORS.error,
              }}
            >
              {offlineSyncStatus === "pending"
                ? "Saved Offline · Pending Sync"
                : "Sync Failed · Will Retry"}
            </Text>
          </View>
        )}

        {/* Stats row */}
        {group.status === "completed" && (
          <View className="flex-row flex-wrap gap-xs">
            <View className="flex-row items-center gap-1 bg-bgSurface rounded-full px-sm py-1 border border-borderDark">
              <Ionicons name="fish" size={13} color={COLORS.primary} />
              <Text className="text-xs text-textSecondary font-medium">{fishCount} fish</Text>
            </View>
            <View className="flex-row items-center gap-1 bg-bgSurface rounded-full px-sm py-1 border border-borderDark">
              <Ionicons name="list" size={13} color={COLORS.secondary} />
              <Text className="text-xs text-textSecondary font-medium">{speciesCount} species</Text>
            </View>
            {totalWeight != null && totalWeight > 0 && (
              <View className="flex-row items-center gap-1 bg-bgSurface rounded-full px-sm py-1 border border-borderDark">
                <Ionicons
                  name="scale-outline"
                  size={13}
                  color={COLORS.textSecondary}
                />
                <Text className="text-xs text-textSecondary font-medium">
                  {totalWeight.toFixed(1)} kg
                </Text>
              </View>
            )}
            {hasDiseases && (
              <View
                className="flex-row items-center gap-1 rounded-full px-sm py-1 border border-borderDark"
                style={{ backgroundColor: COLORS.error + "18" }}
              >
                <Ionicons name="warning" size={13} color={COLORS.error} />
                <Text className="text-xs font-medium" style={{ color: COLORS.error }}>
                  Disease
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View className="flex-row gap-xs items-center">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1 bg-primary rounded-md py-sm"
            onPress={onViewDetails}
          >
            <Ionicons name="eye-outline" size={15} color={COLORS.bgDark} />
            <Text className="text-xs font-bold text-bgDark">View Details</Text>
          </TouchableOpacity>

          {group.status === "completed" && !offlineSyncStatus && (
            <TouchableOpacity className="w-9 h-9 items-center justify-center bg-bgSurface rounded-md border border-borderDark" onPress={onAskAI}>
              <Ionicons
                name="chatbubble-outline"
                size={15}
                color={COLORS.primaryLight}
              />
            </TouchableOpacity>
          )}

          {group.status === "completed" && !offlineSyncStatus && (
            <TouchableOpacity className="w-9 h-9 items-center justify-center bg-bgSurface rounded-md border border-borderDark" onPress={onExportPDF}>
              <Ionicons
                name="document-outline"
                size={15}
                color={COLORS.primaryLight}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity className="w-9 h-9 items-center justify-center bg-bgSurface rounded-md border border-borderDark" onPress={handleDelete}>
            <Ionicons name="trash-outline" size={15} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}
