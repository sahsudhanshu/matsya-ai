import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFishermanTools } from "../../lib/api-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { toastService } from "../../lib/toast-service";

interface FishermanToolsProps {
  location: { latitude: number; longitude: number };
  onRefresh?: () => void;
}

interface FishermanToolsData {
  location: { latitude: number; longitude: number };
  date: string;
  sunrise: string;
  sunset: string;
  moonPhase: {
    phase: string;
    illumination: number;
    icon: string;
  };
  tides: Array<{
    time: string;
    type: "high" | "low";
    height: number;
  }>;
  bestFishingTimes: Array<{
    start: string;
    end: string;
    quality: "good" | "better" | "best";
  }>;
}

export function FishermanTools({ location, onRefresh }: FishermanToolsProps) {
  const [data, setData] = useState<FishermanToolsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [location.latitude, location.longitude]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFishermanTools(
        location.latitude,
        location.longitude,
      );
      setData(result);
    } catch (err) {
      console.error("Failed to load fisherman tools data:", err);
      toastService.error("Failed to load fishing data.");
      setError(
        err instanceof Error ? err.message : "Failed to load fishing data",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
    onRefresh?.();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons
            name="compass-outline"
            size={20}
            color={COLORS.primaryLight}
          />
          <Text style={styles.title}>Fisherman Tools</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primaryLight} />
          <Text style={styles.loadingText}>Loading fishing data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons
            name="compass-outline"
            size={20}
            color={COLORS.primaryLight}
          />
          <Text style={styles.title}>Fisherman Tools</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={COLORS.error}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data) {
    return null;
  }

  // Get next tide
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const nextTide =
    data.tides.find((tide) => tide.time > currentTime) || data.tides[0];

  // Get current/next best fishing time
  const bestTime =
    data.bestFishingTimes.find((time) => time.end > currentTime) ||
    data.bestFishingTimes[0];

  // Format moon phase name
  const formatMoonPhase = (phase: string) => {
    return phase
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get quality color
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "best":
        return "#6ee7b7";
      case "better":
        return "#67e8f9";
      case "good":
        return "#fbbf24";
      default:
        return COLORS.textMuted;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Ionicons
          name="compass-outline"
          size={20}
          color={COLORS.primaryLight}
        />
        <Text style={styles.title}>Fisherman Tools</Text>
      </View>

      <View style={styles.toolsGrid}>
        {/* Sunrise/Sunset */}
        <View style={[styles.toolCard, { borderColor: "#f59e0b30" }]}>
          <Ionicons
            name="sunny-outline"
            size={22}
            color="#fbbf24"
            style={{ marginBottom: 4 }}
          />
          <Text style={[styles.toolLabel, { color: "#fbbf24" }]}>Sunrise</Text>
          <Text style={styles.toolValue}>{data.sunrise}</Text>
          <Text style={styles.toolSub}>Sunset {data.sunset}</Text>
        </View>

        {/* Moon Phase */}
        <View style={[styles.toolCard, { borderColor: "#818cf830" }]}>
          <Ionicons
            name="moon-outline"
            size={22}
            color="#a5b4fc"
            style={{ marginBottom: 4 }}
          />
          <Text style={[styles.toolLabel, { color: "#a5b4fc" }]}>Moon</Text>
          <Text style={styles.toolValue}>
            {formatMoonPhase(data.moonPhase.phase)}
          </Text>
          <Text style={styles.toolSub}>
            {Math.round(data.moonPhase.illumination * 100)}% illuminated
          </Text>
        </View>

        {/* Tide Information */}
        <View style={[styles.toolCard, { borderColor: "#22d3ee30" }]}>
          <Ionicons
            name="water-outline"
            size={22}
            color="#67e8f9"
            style={{ marginBottom: 4 }}
          />
          <Text style={[styles.toolLabel, { color: "#67e8f9" }]}>Tide</Text>
          <Text style={styles.toolValue}>
            {nextTide.type === "high" ? "High" : "Low"} →{" "}
            {nextTide.height.toFixed(1)}m
          </Text>
          <Text style={styles.toolSub}>Next: {nextTide.time}</Text>
        </View>

        {/* Best Fishing Times */}
        <View style={[styles.toolCard, { borderColor: "#34d39930" }]}>
          <Ionicons
            name="time-outline"
            size={22}
            color="#6ee7b7"
            style={{ marginBottom: 4 }}
          />
          <Text style={[styles.toolLabel, { color: "#6ee7b7" }]}>
            Best Time
          </Text>
          <Text style={styles.toolValue}>
            {bestTime.start} – {bestTime.end}
          </Text>
          <Text style={styles.toolSub}>
            {bestTime.quality.charAt(0).toUpperCase() +
              bestTime.quality.slice(1)}{" "}
            activity
          </Text>
        </View>
      </View>

      {/* Tide Timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>Tide Schedule</Text>
        <View style={styles.timeline}>
          {data.tides.map((tide, index) => (
            <View key={index} style={styles.timelineItem}>
              <View style={styles.timelineDot}>
                <Ionicons
                  name={tide.type === "high" ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={tide.type === "high" ? "#67e8f9" : "#a5b4fc"}
                />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTime}>{tide.time}</Text>
                <Text style={styles.timelineLabel}>
                  {tide.type === "high" ? "High" : "Low"} Tide
                </Text>
                <Text style={styles.timelineValue}>
                  {tide.height.toFixed(1)}m
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Best Fishing Times Timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>Best Fishing Times</Text>
        <View style={styles.timeline}>
          {data.bestFishingTimes.map((time, index) => (
            <View key={index} style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  { backgroundColor: getQualityColor(time.quality) + "30" },
                ]}
              >
                <Ionicons
                  name="fish-outline"
                  size={12}
                  color={getQualityColor(time.quality)}
                />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTime}>
                  {time.start} – {time.end}
                </Text>
                <Text
                  style={[
                    styles.timelineLabel,
                    { color: getQualityColor(time.quality) },
                  ]}
                >
                  {time.quality.charAt(0).toUpperCase() + time.quality.slice(1)}{" "}
                  Fishing
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
        <Ionicons
          name="refresh-outline"
          size={16}
          color={COLORS.primaryLight}
        />
        <Text style={styles.refreshText}>Refresh Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
  },
  errorText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
    textAlign: "center",
  },
  retryButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  retryButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: SPACING.md,
  },
  toolCard: {
    width: "48%",
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
  },
  toolLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    marginTop: 4,
  },
  toolValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  toolSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  timelineSection: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  timeline: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.bgCard,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  timelineLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timelineValue: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  refreshText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
});
