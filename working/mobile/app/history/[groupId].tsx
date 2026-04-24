import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getGroupDetails } from "../../lib/api-client";
import { GroupStats } from "../../components/history/GroupStats";
import { SpeciesDistribution } from "../../components/history/SpeciesDistribution";
import { FishDetectionCard } from "../../components/history/FishDetectionCard";
import { SkeletonList } from "../../components/ui/Skeleton";
import type { FishDetection } from "../../components/history/FishDetectionCard";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import type { GroupAnalysis, GroupRecord } from "../../lib/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SCREEN_WIDTH = Dimensions.get("window").width;

/**
 * Normalise the raw ML analysis result so that:
 * - analysisResult.detections[] is populated from images[].crops if missing
 * - analysisResult.yoloVisualizationUrls[] is populated from images[].yolo_image_url if missing
 */
function normalizeAnalysisResult(
  result: GroupAnalysis | undefined,
): GroupAnalysis | undefined {
  if (!result) return result;

  // Build detections from images[].crops if not already present
  if (!result.detections || result.detections.length === 0) {
    const detections: NonNullable<GroupAnalysis["detections"]> = [];
    for (const image of result.images || []) {
      if (image.error) continue;
      for (const crop of Object.values(image.crops || {})) {
        detections.push({
          cropUrl: (crop as any).crop_url || "",
          species: (crop as any).species?.label || "Unknown",
          confidence: (crop as any).species?.confidence || 0,
          diseaseStatus: (crop as any).disease?.label || "Healthy",
          diseaseConfidence: (crop as any).disease?.confidence || 0,
          weight: (crop as any).weight_kg ?? 0,
          value: (crop as any).estimatedValue ?? 0,
          gradcamUrls: {
            species: (crop as any).species?.gradcam_url || "",
            disease: (crop as any).disease?.gradcam_url || "",
          },
        });
      }
    }
    result = { ...result, detections };
  }

  // Build yoloVisualizationUrls from images[].yolo_image_url if not already present
  if (
    !result.yoloVisualizationUrls ||
    result.yoloVisualizationUrls.length === 0
  ) {
    const yoloUrls = (result.images || [])
      .map((img: any) => img.yolo_image_url)
      .filter(Boolean) as string[];
    result = { ...result, yoloVisualizationUrls: yoloUrls };
  }

  return result;
}

/**
 * Merge weight estimates from the group record into individual detections
 * so that FishDetectionCard can display per-fish weight and value.
 */
function mergeWeightEstimates(data: GroupRecord) {
  const estimates = data.weightEstimates;
  const detections = data.analysisResult?.detections;
  if (!estimates || !detections) return;

  for (let i = 0; i < detections.length; i++) {
    const entry = estimates[`fish_${i}`];
    if (!entry) continue;
    if (typeof entry === "number") {
      // Legacy: plain numeric kg value
      detections[i] = { ...detections[i], weight: entry };
    } else if (typeof entry === "object") {
      const weightKg = entry.weightKg ?? (entry.estimated_weight_grams ? entry.estimated_weight_grams / 1000 : 0);
      const value = entry.estimated_fish_value
        ? Math.round((entry.estimated_fish_value.min_inr + entry.estimated_fish_value.max_inr) / 2)
        : 0;
      detections[i] = { ...detections[i], weight: weightKg, value };
    }
  }
}

export default function HistoryDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDetections, setExpandedDetections] = useState<Set<number>>(
    new Set(),
  );
  const [showDiseasedOnly, setShowDiseasedOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (groupId) {
      loadGroupDetails();
    }
  }, [groupId]);

  const loadGroupDetails = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) setLoading(true);
      setError(null);

      // Try cache first
      const cacheKey = `group_detail_${groupId}`;
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsedData = JSON.parse(cached);
            parsedData.analysisResult = normalizeAnalysisResult(
              parsedData.analysisResult,
            );
            mergeWeightEstimates(parsedData);
            setGroup(parsedData);
            setLoading(false);
          } catch (parseError) {
            console.error("Failed to parse cached group details:", parseError);
            await AsyncStorage.removeItem(cacheKey);
          }
        }
      }

      // Fetch fresh data
      const data = await getGroupDetails(groupId);
      data.analysisResult = normalizeAnalysisResult(data.analysisResult);
      mergeWeightEstimates(data);
      setGroup(data);

      // Cache the data
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (err) {
      setError("Failed to load group details");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadGroupDetails(true);
  }, [groupId]);

  const toggleDetection = (index: number) => {
    setExpandedDetections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleViewOnMap = () => {
    if (group?.latitude && group?.longitude) {
      const url = `https://maps.google.com/?q=${group.latitude},${group.longitude}`;
      Linking.openURL(url);
    }
  };

  const handleAskAI = () => {
    router.push({
      pathname: "/(tabs)/chat",
      params: { groupId },
    });
  };

  const handleExportPDF = () => {
    // PDF export will be implemented in Task 9
    console.log("Export PDF for group:", groupId);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          <SkeletonList itemCount={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error || "Group not found"}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadGroupDetails()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const stats = group.analysisResult?.aggregateStats;
  const detections = group.analysisResult?.detections || [];
  const filteredDetections = showDiseasedOnly
    ? detections.filter((d) => d.diseaseStatus !== "Healthy")
    : detections;

  const createdDate = new Date(group.createdAt);
  const completedDate = group.completedAt ? new Date(group.completedAt) : null;
  const duration = completedDate
    ? Math.round((completedDate.getTime() - createdDate.getTime()) / 1000)
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Analysis Details</Text>
          <Text style={styles.subtitle}>
            Group ID: {groupId.substring(0, 8)}...
          </Text>
        </View>
        <TouchableOpacity onPress={handleExportPDF} style={styles.iconBtn}>
          <Ionicons
            name="document-outline"
            size={24}
            color={COLORS.primaryLight}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAskAI} style={styles.iconBtn}>
          <Ionicons
            name="chatbubble-outline"
            size={24}
            color={COLORS.primaryLight}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Metadata */}
        <View style={styles.metadataCard}>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Created</Text>
            <Text style={styles.metadataValue}>
              {createdDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          {completedDate && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Completed</Text>
              <Text style={styles.metadataValue}>
                {completedDate.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          )}
          {duration && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Duration</Text>
              <Text style={styles.metadataValue}>{duration}s</Text>
            </View>
          )}
        </View>

        {/* Location */}
        {group.latitude && group.longitude && (
          <View style={styles.locationCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>Scan Location</Text>
              <Text style={styles.locationCoords}>
                {group.latitude.toFixed(6)}°N, {group.longitude.toFixed(6)}°E
              </Text>
            </View>
            <TouchableOpacity style={styles.mapBtn} onPress={handleViewOnMap}>
              <Text style={styles.mapBtnText}>View on Map</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Aggregate Statistics */}
        {stats && (
          <GroupStats
            stats={{
              totalFishCount: stats.totalFishCount,
              speciesCount: Object.keys(stats.speciesDistribution).length,
              totalWeight: stats.totalEstimatedWeight,
              totalValue: stats.totalEstimatedValue,
              diseaseDetected: stats.diseaseDetected ?? detections.some(
                (d) => !d.diseaseStatus.toLowerCase().includes("healthy"),
              ),
            }}
          />
        )}

        {/* Species Distribution */}
        {stats?.speciesDistribution && (
          <SpeciesDistribution distribution={stats.speciesDistribution} />
        )}

        {/* Original Images Gallery */}
        {group.presignedViewUrls && group.presignedViewUrls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Original Images ({group.presignedViewUrls.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: SPACING.sm }}
            >
              {group.presignedViewUrls.map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={styles.originalImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* YOLO Detection Visualizations */}
        {group.analysisResult?.yoloVisualizationUrls &&
          group.analysisResult.yoloVisualizationUrls.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detection Visualizations</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {group.analysisResult.yoloVisualizationUrls.map(
                  (url, index) => (
                    <Image
                      key={index}
                      source={{ uri: url }}
                      style={styles.yoloImage}
                      resizeMode="cover"
                    />
                  ),
                )}
              </ScrollView>
            </View>
          )}

        {/* Individual Fish Detections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Individual Fish ({filteredDetections.length})
            </Text>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setShowDiseasedOnly(!showDiseasedOnly)}
            >
              <Text style={styles.filterBtnText}>
                {showDiseasedOnly ? "All" : "Diseased"}
              </Text>
            </TouchableOpacity>
          </View>

          {filteredDetections.map((detection, index) => (
            <FishDetectionCard
              key={index}
              detection={detection}
              onExpand={() => toggleDetection(index)}
              expanded={expandedDetections.has(index)}
            />
          ))}

          {filteredDetections.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={COLORS.success}
              />
              <Text style={styles.emptyText}>
                {showDiseasedOnly
                  ? "No diseased fish detected"
                  : "No fish detections available"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  title: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  iconBtn: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  errorIcon: {
    fontSize: 34,
    marginBottom: SPACING.md,
  },
  errorTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  retryText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  metadataCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  metadataLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  metadataValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  locationTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  mapBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  mapBtnText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  filterBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
  },
  yoloImage: {
    width: 160,
    height: 160,
    borderRadius: RADIUS.lg,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.bgSurface,
  },
  originalImage: {
    width: SCREEN_WIDTH * 0.65,
    height: 200,
    borderRadius: RADIUS.lg,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.bgSurface,
  },
  emptyState: {
    alignItems: "center",
    padding: SPACING.lg,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});
