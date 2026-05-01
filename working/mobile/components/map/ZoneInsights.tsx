/**
 * ZoneInsights Component
 *
 * Displays live fishing zone insights with recommendations on the map.
 * Features:
 * - Zone markers on map with color-coded fishing conditions
 * - Zone selection to show detailed insights
 * - Fishing conditions rating (poor, fair, good, excellent)
 * - Target species recommendations
 * - Expected catch size and safety rating
 * - Recent activity statistics
 * - Offline caching for zone data
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Marker } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getFishingZones, getZoneInsights } from "../../lib/api-client";
import type { FishingZone } from "../../lib/types";
import { Colors } from "../../lib/colors";
import { SPACING, FONTS } from "../../lib/constants";
import { toastService } from "../../lib/toast-service";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZoneInsight {
  zoneId: string;
  zoneName: string;
  location: { latitude: number; longitude: number };
  recommendations: {
    fishingConditions: "poor" | "fair" | "good" | "excellent";
    targetSpecies: string[];
    expectedCatchSize: "small" | "medium" | "large";
    safetyRating: number;
  };
  recentActivity: {
    catchCount: number;
    topSpecies: string;
    avgQuality: string;
  };
  updatedAt: string;
}

interface ZoneInsightsProps {
  /** User's current location for fetching nearby zones */
  userLocation: { latitude: number; longitude: number } | null;
  /** Callback when a zone is selected */
  onZoneSelect?: (zoneId: string) => void;
  /** Callback to refresh zone data */
  onRefresh?: () => void;
}

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Get color for fishing conditions rating
 */
function getConditionColor(
  condition: "poor" | "fair" | "good" | "excellent",
): string {
  switch (condition) {
    case "excellent":
      return Colors.semantic.success;
    case "good":
      return Colors.primary[500];
    case "fair":
      return Colors.semantic.warning;
    case "poor":
      return Colors.semantic.error;
    default:
      return Colors.neutral[500];
  }
}

/**
 * Get icon for fishing conditions
 */
function getConditionIcon(
  condition: "poor" | "fair" | "good" | "excellent",
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (condition) {
    case "excellent":
      return "star";
    case "good":
      return "thumbs-up";
    case "fair":
      return "hand-left";
    case "poor":
      return "thumbs-down";
    default:
      return "help-circle";
  }
}

/**
 * Get color for catch size
 */
function getCatchSizeColor(size: "small" | "medium" | "large"): string {
  switch (size) {
    case "large":
      return Colors.semantic.success;
    case "medium":
      return Colors.primary[500];
    case "small":
      return Colors.semantic.warning;
    default:
      return Colors.neutral[500];
  }
}

/**
 * Get color for safety rating (1-10 scale)
 */
function getSafetyColor(rating: number): string {
  if (rating >= 8) return Colors.semantic.success;
  if (rating >= 6) return Colors.primary[500];
  if (rating >= 4) return Colors.semantic.warning;
  return Colors.semantic.error;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ZoneInsights({
  userLocation,
  onZoneSelect,
  onRefresh,
}: ZoneInsightsProps) {
  const [zones, setZones] = useState<FishingZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedZoneInsight, setSelectedZoneInsight] =
    useState<ZoneInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch nearby fishing zones
  const fetchZones = useCallback(async () => {
    if (!userLocation) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedZones = await getFishingZones({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radius: 100, // 100km radius
      });
      setZones(fetchedZones);
    } catch (err) {
      console.error("Failed to fetch fishing zones:", err);
      toastService.error("Failed to load zone insights.");
      setError("Failed to load fishing zones");
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Fetch zone insights when a zone is selected
  const fetchZoneInsights = useCallback(async (zoneId: string) => {
    setInsightLoading(true);
    try {
      const insight = await getZoneInsights(zoneId);
      setSelectedZoneInsight(insight);
    } catch (err) {
      console.error(`Failed to fetch insights for zone ${zoneId}:`, err);
      toastService.error("Failed to load zone insights.");
      setSelectedZoneInsight(null);
    } finally {
      setInsightLoading(false);
    }
  }, []);

  // Handle zone selection
  const handleZonePress = useCallback(
    (zoneId: string) => {
      setSelectedZoneId(zoneId);
      fetchZoneInsights(zoneId);
      onZoneSelect?.(zoneId);
    },
    [fetchZoneInsights, onZoneSelect],
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchZones();
    if (selectedZoneId) {
      fetchZoneInsights(selectedZoneId);
    }
    onRefresh?.();
  }, [fetchZones, fetchZoneInsights, selectedZoneId, onRefresh]);

  // Initial fetch
  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Render zone markers on map
  const renderZoneMarkers = () => {
    return zones.map((zone) => {
      const isSelected = zone.zoneId === selectedZoneId;
      const conditionColor = getConditionColor(zone.health);

      return (
        <Marker
          key={zone.zoneId}
          coordinate={zone.coordinates}
          onPress={() => handleZonePress(zone.zoneId)}
        >
          <View
            className="items-center justify-center rounded-full border-white shadow-md shadow-black/25"
            style={{
              backgroundColor: conditionColor,
              width: isSelected ? 44 : 36,
              height: isSelected ? 44 : 36,
              borderRadius: isSelected ? 22 : 18,
              borderWidth: isSelected ? 3 : 2,
            }}
          >
            <Ionicons
              name="location"
              size={isSelected ? 24 : 20}
              color="#fff"
            />
          </View>
        </Marker>
      );
    });
  };

  return (
    <>
      {/* Zone Markers */}
      {renderZoneMarkers()}

      {/* Zone Detail Card (shown when a zone is selected) */}
      {selectedZoneId && (
        <View className="absolute bottom-0 left-0 right-0 max-h-[60%] rounded-t-[20px] bg-white shadow-lg shadow-black/10">
          <View className="mt-2 mb-4 h-1 w-10 self-center rounded-sm bg-gray-300" />

          {insightLoading ? (
            <View className="items-center gap-2 p-8">
              <ActivityIndicator size="small" color={Colors.primary[500]} />
              <Text className="text-[12px] text-gray-500">Loading zone insights...</Text>
            </View>
          ) : selectedZoneInsight ? (
            <ScrollView
              className="px-4 pb-6"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View className="mb-6 flex-row items-start">
                <View className="flex-1">
                  <Text className="mb-1 text-[13px] font-bold text-gray-900">
                    {selectedZoneInsight.zoneName}
                  </Text>
                  <Text className="text-[12px] text-gray-500">
                    {selectedZoneInsight.location.latitude.toFixed(4)}°N,{" "}
                    {selectedZoneInsight.location.longitude.toFixed(4)}°E
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedZoneId(null);
                    setSelectedZoneInsight(null);
                  }}
                  className="p-1"
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={Colors.neutral[500]}
                  />
                </TouchableOpacity>
              </View>

              {/* Fishing Conditions */}
              <View className="mb-6">
                <Text className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-700">Fishing Conditions</Text>
                <View
                  className="flex-row items-center gap-2 self-start rounded-lg px-4 py-2"
                  style={{
                    backgroundColor:
                      getConditionColor(
                        selectedZoneInsight.recommendations.fishingConditions,
                      ) + "20",
                  }}
                >
                  <Ionicons
                    name={getConditionIcon(
                      selectedZoneInsight.recommendations.fishingConditions,
                    )}
                    size={20}
                    color={getConditionColor(
                      selectedZoneInsight.recommendations.fishingConditions,
                    )}
                  />
                  <Text
                    className="text-[12px] font-bold tracking-wide"
                    style={{
                      color: getConditionColor(
                        selectedZoneInsight.recommendations.fishingConditions,
                      ),
                    }}
                  >
                    {selectedZoneInsight.recommendations.fishingConditions.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Target Species */}
              <View className="mb-6">
                <Text className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-700">Target Species</Text>
                <View className="flex-row flex-wrap gap-2">
                  {selectedZoneInsight.recommendations.targetSpecies.map(
                    (species, index) => (
                      <View key={index} className="flex-row items-center gap-1 rounded-2xl border border-blue-500/30 bg-blue-50 px-2 py-1">
                        <Ionicons
                          name="fish"
                          size={14}
                          color={Colors.primary[500]}
                        />
                        <Text className="text-[12px] font-medium text-blue-700">{species}</Text>
                      </View>
                    ),
                  )}
                </View>
              </View>

              {/* Expected Catch Size & Safety */}
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <View className="mb-1 flex-row items-center gap-1">
                    <Ionicons
                      name="resize-outline"
                      size={16}
                      color={Colors.neutral[500]}
                    />
                    <Text className="text-[10px] uppercase tracking-wide text-gray-500">Catch Size</Text>
                  </View>
                  <Text
                    className="text-[12px] font-bold"
                    style={{
                      color: getCatchSizeColor(
                        selectedZoneInsight.recommendations.expectedCatchSize,
                      ),
                    }}
                  >
                    {selectedZoneInsight.recommendations.expectedCatchSize.toUpperCase()}
                  </Text>
                </View>

                <View className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <View className="mb-1 flex-row items-center gap-1">
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color={Colors.neutral[500]}
                    />
                    <Text className="text-[10px] uppercase tracking-wide text-gray-500">Safety</Text>
                  </View>
                  <Text
                    className="text-[12px] font-bold"
                    style={{
                      color: getSafetyColor(
                        selectedZoneInsight.recommendations.safetyRating,
                      ),
                    }}
                  >
                    {selectedZoneInsight.recommendations.safetyRating}/10
                  </Text>
                </View>
              </View>

              {/* Recent Activity */}
              <View className="mb-6">
                <Text className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-700">Recent Activity</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1 items-center gap-1 rounded-lg bg-gray-50 p-2">
                    <Ionicons
                      name="fish-outline"
                      size={18}
                      color={Colors.primary[500]}
                    />
                    <Text className="text-center text-[10px] text-gray-500">Catches</Text>
                    <Text className="text-center text-[12px] font-bold text-gray-900">
                      {selectedZoneInsight.recentActivity.catchCount}
                    </Text>
                  </View>
                  <View className="flex-1 items-center gap-1 rounded-lg bg-gray-50 p-2">
                    <Ionicons
                      name="star-outline"
                      size={18}
                      color={Colors.primary[500]}
                    />
                    <Text className="text-center text-[10px] text-gray-500">Top Species</Text>
                    <Text className="text-center text-[12px] font-bold text-gray-900">
                      {selectedZoneInsight.recentActivity.topSpecies}
                    </Text>
                  </View>
                  <View className="flex-1 items-center gap-1 rounded-lg bg-gray-50 p-2">
                    <Ionicons
                      name="ribbon-outline"
                      size={18}
                      color={Colors.primary[500]}
                    />
                    <Text className="text-center text-[10px] text-gray-500">Avg Quality</Text>
                    <Text className="text-center text-[12px] font-bold text-gray-900">
                      {selectedZoneInsight.recentActivity.avgQuality}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Last Updated */}
              <Text className="mb-2 mt-4 text-center text-[10px] text-gray-500">
                Updated{" "}
                {new Date(selectedZoneInsight.updatedAt).toLocaleString()}
              </Text>

              {/* Refresh Button */}
              <TouchableOpacity
                className="mt-2 flex-row items-center justify-center gap-1 rounded-lg border border-blue-500 py-2"
                onPress={handleRefresh}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={Colors.primary[500]}
                />
                <Text className="text-[12px] font-semibold text-blue-500">Refresh Data</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View className="items-center gap-4 p-8">
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={Colors.semantic.error}
              />
              <Text className="text-center text-[13px] text-gray-700">Failed to load zone insights</Text>
              <TouchableOpacity
                className="mt-2 rounded-lg bg-blue-500 px-6 py-2"
                onPress={() =>
                  selectedZoneId && fetchZoneInsights(selectedZoneId)
                }
              >
                <Text className="text-[12px] font-semibold text-white">Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </>
  );
}
