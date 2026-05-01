import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <View className="flex-row items-center gap-2 border-b border-[#334155] px-4 py-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text className="flex-1 text-[15px] font-bold text-[#f8fafc]">Loading...</Text>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flex: 1 }}
        >
          <SkeletonList itemCount={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="warning" size={48} color={COLORS.error} />
          <Text className="mb-1 text-[15px] font-bold text-[#f8fafc]">Failed to Load</Text>
          <Text className="mb-6 text-center text-[13px] text-[#94a3b8]">{error || "Group not found"}</Text>
          <TouchableOpacity
            className="rounded-[12px] bg-[#1e40af] px-8 py-2"
            onPress={() => loadGroupDetails()}
          >
            <Text className="text-[13px] font-bold text-[#f8fafc]">Retry</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      {/* Header */}
      <View className="flex-row items-center gap-2 border-b border-[#334155] px-4 py-2">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text className="text-[15px] font-bold text-[#f8fafc]">Analysis Details</Text>
          <Text className="text-[11px] text-[#94a3b8]">
            Group ID: {groupId.substring(0, 8)}...
          </Text>
        </View>
        <TouchableOpacity onPress={handleExportPDF} className="p-1">
          <Ionicons
            name="document-outline"
            size={24}
            color={COLORS.primaryLight}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAskAI} className="p-1">
          <Ionicons
            name="chatbubble-outline"
            size={24}
            color={COLORS.primaryLight}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24 }}
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
        <View className="mb-4 rounded-[12px] border border-[#334155] bg-[#1e293b] p-4">
          <View className="flex-row items-center justify-between py-1">
            <Text className="text-[13px] text-[#94a3b8]">Created</Text>
            <Text className="text-[13px] font-semibold text-[#f8fafc]">
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
            <View className="flex-row items-center justify-between py-1">
              <Text className="text-[13px] text-[#94a3b8]">Completed</Text>
              <Text className="text-[13px] font-semibold text-[#f8fafc]">
                {completedDate.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          )}
          {duration && (
            <View className="flex-row items-center justify-between py-1">
              <Text className="text-[13px] text-[#94a3b8]">Duration</Text>
              <Text className="text-[13px] font-semibold text-[#f8fafc]">{duration}s</Text>
            </View>
          )}
        </View>

        {/* Location */}
        {group.latitude && group.longitude && (
          <View className="mb-4 flex-row items-center rounded-[12px] border border-[#334155] bg-[#1e293b] p-4">
            <View style={{ flex: 1 }}>
              <Text className="mb-0.5 text-[13px] font-bold text-[#f8fafc]">Scan Location</Text>
              <Text className="text-[11px] text-[#94a3b8]">
                {Number(group.latitude).toFixed(6)}°N, {Number(group.longitude).toFixed(6)}°E
              </Text>
            </View>
            <TouchableOpacity className="rounded-[10px] bg-[#1e40af] px-4 py-2" onPress={handleViewOnMap}>
              <Text className="text-[11px] font-bold text-[#f8fafc]">View on Map</Text>
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
          <View className="mb-6">
            <Text className="text-[15px] font-bold text-[#f8fafc]">
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
                  className="mr-2 h-[200px] rounded-[12px] bg-[#334155]"
                  style={{ width: SCREEN_WIDTH * 0.65 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* YOLO Detection Visualizations */}
        {group.analysisResult?.yoloVisualizationUrls &&
          group.analysisResult.yoloVisualizationUrls.length > 0 && (
            <View className="mb-6">
              <Text className="mb-2 text-[15px] font-bold text-[#f8fafc]">Detection Visualizations</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {group.analysisResult.yoloVisualizationUrls.map(
                  (url, index) => (
                    <Image
                      key={index}
                      source={{ uri: url }}
                      className="mr-2 h-[160px] w-[160px] rounded-[12px] bg-[#334155]"
                      resizeMode="cover"
                    />
                  ),
                )}
              </ScrollView>
            </View>
          )}

        {/* Individual Fish Detections */}
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-[#f8fafc]">
              Individual Fish ({filteredDetections.length})
            </Text>
            <TouchableOpacity
              className="rounded-[10px] border border-[#334155] bg-[#1e293b] px-4 py-1"
              onPress={() => setShowDiseasedOnly(!showDiseasedOnly)}
            >
              <Text className="text-[11px] font-semibold text-[#e2e8f0]">
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
            <View className="items-center p-6">
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={COLORS.success}
              />
              <Text className="mt-4 text-center text-[13px] text-[#94a3b8]">
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
