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
  StyleSheet,
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
            style={[
              styles.zoneMarker,
              { backgroundColor: conditionColor },
              isSelected && styles.zoneMarkerSelected,
            ]}
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
        <View style={styles.detailCard}>
          <View style={styles.detailCardHandle} />

          {insightLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary[500]} />
              <Text style={styles.loadingText}>Loading zone insights...</Text>
            </View>
          ) : selectedZoneInsight ? (
            <ScrollView
              style={styles.detailContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneName}>
                    {selectedZoneInsight.zoneName}
                  </Text>
                  <Text style={styles.zoneCoords}>
                    {selectedZoneInsight.location.latitude.toFixed(4)}°N,{" "}
                    {selectedZoneInsight.location.longitude.toFixed(4)}°E
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedZoneId(null);
                    setSelectedZoneInsight(null);
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={Colors.neutral[500]}
                  />
                </TouchableOpacity>
              </View>

              {/* Fishing Conditions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Fishing Conditions</Text>
                <View
                  style={[
                    styles.conditionBadge,
                    {
                      backgroundColor:
                        getConditionColor(
                          selectedZoneInsight.recommendations.fishingConditions,
                        ) + "20",
                    },
                  ]}
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
                    style={[
                      styles.conditionText,
                      {
                        color: getConditionColor(
                          selectedZoneInsight.recommendations.fishingConditions,
                        ),
                      },
                    ]}
                  >
                    {selectedZoneInsight.recommendations.fishingConditions.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Target Species */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Target Species</Text>
                <View style={styles.speciesList}>
                  {selectedZoneInsight.recommendations.targetSpecies.map(
                    (species, index) => (
                      <View key={index} style={styles.speciesChip}>
                        <Ionicons
                          name="fish"
                          size={14}
                          color={Colors.primary[500]}
                        />
                        <Text style={styles.speciesText}>{species}</Text>
                      </View>
                    ),
                  )}
                </View>
              </View>

              {/* Expected Catch Size & Safety */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Ionicons
                      name="resize-outline"
                      size={16}
                      color={Colors.neutral[500]}
                    />
                    <Text style={styles.statLabel}>Catch Size</Text>
                  </View>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color: getCatchSizeColor(
                          selectedZoneInsight.recommendations.expectedCatchSize,
                        ),
                      },
                    ]}
                  >
                    {selectedZoneInsight.recommendations.expectedCatchSize.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color={Colors.neutral[500]}
                    />
                    <Text style={styles.statLabel}>Safety</Text>
                  </View>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color: getSafetyColor(
                          selectedZoneInsight.recommendations.safetyRating,
                        ),
                      },
                    ]}
                  >
                    {selectedZoneInsight.recommendations.safetyRating}/10
                  </Text>
                </View>
              </View>

              {/* Recent Activity */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <View style={styles.activityGrid}>
                  <View style={styles.activityItem}>
                    <Ionicons
                      name="fish-outline"
                      size={18}
                      color={Colors.primary[500]}
                    />
                    <Text style={styles.activityLabel}>Catches</Text>
                    <Text style={styles.activityValue}>
                      {selectedZoneInsight.recentActivity.catchCount}
                    </Text>
                  </View>
                  <View style={styles.activityItem}>
                    <Ionicons
                      name="star-outline"
                      size={18}
                      color={Colors.primary[500]}
                    />
                    <Text style={styles.activityLabel}>Top Species</Text>
                    <Text style={styles.activityValue}>
                      {selectedZoneInsight.recentActivity.topSpecies}
                    </Text>
                  </View>
                  <View style={styles.activityItem}>
                    <Ionicons
                      name="ribbon-outline"
                      size={18}
                      color={Colors.primary[500]}
                    />
                    <Text style={styles.activityLabel}>Avg Quality</Text>
                    <Text style={styles.activityValue}>
                      {selectedZoneInsight.recentActivity.avgQuality}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Last Updated */}
              <Text style={styles.lastUpdated}>
                Updated{" "}
                {new Date(selectedZoneInsight.updatedAt).toLocaleString()}
              </Text>

              {/* Refresh Button */}
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleRefresh}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={Colors.primary[500]}
                />
                <Text style={styles.refreshButtonText}>Refresh Data</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={Colors.semantic.error}
              />
              <Text style={styles.errorText}>Failed to load zone insights</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() =>
                  selectedZoneId && fetchZoneInsights(selectedZoneId)
                }
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Zone Marker
  zoneMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  zoneMarkerSelected: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },

  // Detail Card
  detailCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background.light,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  detailCardHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.neutral[300],
    borderRadius: 2,
    alignSelf: "center",
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },

  // Loading State
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: FONTS.sizes.sm,
    color: Colors.neutral[500],
  },

  // Error State
  errorContainer: {
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
  },
  errorText: {
    fontSize: FONTS.sizes.base,
    color: Colors.neutral[700],
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: Colors.primary[500],
    borderRadius: 8,
    marginTop: SPACING.sm,
  },
  retryButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
    color: "#fff",
  },

  // Header
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.lg,
  },
  zoneName: {
    fontSize: FONTS.sizes.base,
    fontWeight: "700",
    color: Colors.neutral[900],
    marginBottom: SPACING.xs,
  },
  zoneCoords: {
    fontSize: FONTS.sizes.sm,
    color: Colors.neutral[500],
  },
  closeButton: {
    padding: SPACING.xs,
  },

  // Section
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
    color: Colors.neutral[700],
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Fishing Conditions
  conditionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  conditionText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Target Species
  speciesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  speciesChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: Colors.primary[50],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary[500] + "30",
  },
  speciesText: {
    fontSize: FONTS.sizes.sm,
    color: Colors.primary[700],
    fontWeight: "500",
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: Colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
  },

  // Recent Activity
  activityGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  activityItem: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: "center",
    gap: SPACING.xs,
  },
  activityLabel: {
    fontSize: FONTS.sizes.xs,
    color: Colors.neutral[500],
    textAlign: "center",
  },
  activityValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
    color: Colors.neutral[900],
    textAlign: "center",
  },

  // Footer
  lastUpdated: {
    fontSize: FONTS.sizes.xs,
    color: Colors.neutral[500],
    textAlign: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary[500],
    marginTop: SPACING.sm,
  },
  refreshButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
    color: Colors.primary[500],
  },
});
