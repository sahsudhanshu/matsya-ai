import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { COLORS, RADIUS, SPACING } from "../../lib/constants";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = RADIUS.sm,
  style,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton for stat cards
 */
export function SkeletonStatCard({ style }: { style?: any }) {
  return (
    <View style={[styles.statCard, style]}>
      <Skeleton width={24} height={24} borderRadius={12} />
      <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
      <Skeleton width="80%" height={24} style={{ marginTop: 4 }} />
    </View>
  );
}

/**
 * Skeleton for bar chart
 */
export function SkeletonBarChart() {
  return (
    <View style={styles.barChart}>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View key={i} style={styles.barWrapper}>
          <Skeleton width={40} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={16} height={Math.random() * 80 + 40} />
          <Skeleton width={30} height={10} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for species breakdown
 */
export function SkeletonSpeciesBreakdown() {
  return (
    <View>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.speciesRow}>
          <Skeleton width={8} height={8} borderRadius={4} />
          <Skeleton width={80} height={14} style={{ marginLeft: 8 }} />
          <Skeleton width="40%" height={8} style={{ marginLeft: 8, flex: 1 }} />
          <Skeleton width={35} height={12} style={{ marginLeft: 8 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for quality cards
 */
export function SkeletonQualityCards() {
  return (
    <View style={styles.qualityRow}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.qualityCard}>
          <Skeleton width={10} height={10} borderRadius={5} />
          <Skeleton width={60} height={14} style={{ marginTop: 8 }} />
          <Skeleton width={40} height={28} style={{ marginTop: 4 }} />
          <Skeleton width={50} height={10} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for catch history item
 */
export function SkeletonCatchItem() {
  return (
    <View style={styles.catchItem}>
      <View style={styles.catchRow}>
        <View style={styles.catchLeft}>
          <Skeleton width={22} height={22} borderRadius={11} />
          <View style={{ marginLeft: 12 }}>
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={10} style={{ marginTop: 4 }} />
          </View>
        </View>
        <View style={styles.catchRight}>
          <Skeleton width={60} height={20} borderRadius={10} />
          <Skeleton width={50} height={14} style={{ marginTop: 4 }} />
          <Skeleton width={40} height={14} style={{ marginTop: 2 }} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for card-based layouts
 */
export function SkeletonCard({ style }: { style?: any }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton width="100%" height={200} borderRadius={RADIUS.md} />
      <View style={{ padding: SPACING.md }}>
        <Skeleton width="80%" height={20} />
        <Skeleton width="100%" height={14} style={{ marginTop: SPACING.sm }} />
        <Skeleton width="90%" height={14} style={{ marginTop: SPACING.xs }} />
        <View
          style={{
            flexDirection: "row",
            marginTop: SPACING.md,
            gap: SPACING.sm,
          }}
        >
          <Skeleton width={80} height={32} borderRadius={RADIUS.sm} />
          <Skeleton width={80} height={32} borderRadius={RADIUS.sm} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for list views
 */
export function SkeletonList({ itemCount = 5 }: { itemCount?: number }) {
  return (
    <View>
      {Array.from({ length: itemCount }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <Skeleton width={48} height={48} borderRadius={RADIUS.sm} />
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Skeleton width="70%" height={16} />
            <Skeleton
              width="50%"
              height={12}
              style={{ marginTop: SPACING.xs }}
            />
            <Skeleton
              width="40%"
              height={12}
              style={{ marginTop: SPACING.xs }}
            />
          </View>
          <Skeleton width={24} height={24} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for analytics charts
 */
export function SkeletonChart({ style }: { style?: any }) {
  return (
    <View style={[styles.chartContainer, style]}>
      <View style={styles.chartHeader}>
        <Skeleton width={120} height={20} />
        <Skeleton width={60} height={14} />
      </View>
      <View style={styles.chartBody}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} style={styles.chartBar}>
            <Skeleton
              width={32}
              height={Math.random() * 100 + 50}
              borderRadius={RADIUS.xs}
            />
            <Skeleton
              width={24}
              height={10}
              style={{ marginTop: SPACING.xs }}
            />
          </View>
        ))}
      </View>
      <View style={styles.chartLegend}>
        <Skeleton width={80} height={12} />
        <Skeleton width={100} height={12} />
      </View>
    </View>
  );
}

/**
 * Skeleton for map loading
 */
export function SkeletonMap({ style }: { style?: any }) {
  return (
    <View style={[styles.mapContainer, style]}>
      <Skeleton width="100%" height="100%" borderRadius={0} />
      <View style={styles.mapControls}>
        <Skeleton width={48} height={48} borderRadius={RADIUS.md} />
        <Skeleton
          width={48}
          height={48}
          borderRadius={RADIUS.md}
          style={{ marginTop: SPACING.sm }}
        />
        <Skeleton
          width={48}
          height={48}
          borderRadius={RADIUS.md}
          style={{ marginTop: SPACING.sm }}
        />
      </View>
      <View style={styles.mapSearch}>
        <Skeleton width="100%" height={48} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
}

/**
 * Skeleton for profile loading
 */
export function SkeletonProfile({ style }: { style?: any }) {
  return (
    <View style={[styles.profileContainer, style]}>
      {/* Avatar and header */}
      <View style={styles.profileHeader}>
        <Skeleton width={100} height={100} borderRadius={50} />
        <Skeleton width={150} height={24} style={{ marginTop: SPACING.md }} />
        <Skeleton width={200} height={14} style={{ marginTop: SPACING.xs }} />
      </View>

      {/* Stats row */}
      <View style={styles.profileStats}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.profileStat}>
            <Skeleton width={60} height={28} />
            <Skeleton
              width={80}
              height={12}
              style={{ marginTop: SPACING.xs }}
            />
          </View>
        ))}
      </View>

      {/* Info sections */}
      <View style={styles.profileSections}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.profileSection}>
            <Skeleton width={100} height={16} />
            <Skeleton
              width="100%"
              height={14}
              style={{ marginTop: SPACING.sm }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.border,
  },
  statCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: "47%",
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 160,
    paddingHorizontal: 8,
  },
  barWrapper: {
    alignItems: "center",
    flex: 1,
  },
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  qualityRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  qualityCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  catchItem: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  catchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catchLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  catchRight: {
    alignItems: "flex-end",
  },
  // New skeleton styles
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    marginBottom: SPACING.md,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  chartContainer: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  chartBody: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 180,
    marginBottom: SPACING.md,
  },
  chartBar: {
    alignItems: "center",
    flex: 1,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: SPACING.sm,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapControls: {
    position: "absolute",
    right: SPACING.md,
    top: SPACING.xl,
  },
  mapSearch: {
    position: "absolute",
    top: SPACING.md,
    left: SPACING.md,
    right: 80,
  },
  profileContainer: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  profileStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  profileStat: {
    alignItems: "center",
  },
  profileSections: {
    padding: SPACING.md,
  },
  profileSection: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
});
