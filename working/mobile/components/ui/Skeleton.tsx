import React, { useEffect, useRef } from "react";
import { View,  Animated } from "react-native";
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
      className="bg-[#334155]"
      style={[
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
export function SkeletonStatCard({ style, className }: { style?: any, className?: string }) {
  return (
    <View style={style} className={`w-[47%] rounded-[12px] bg-[#1e293b] p-4 ${className || ""}`}>
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
    <View className="h-[160px] flex-row items-end justify-between px-2">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View key={i} className="flex-1 items-center">
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
        <View key={i} className="flex-row items-center py-4">
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
    <View className="flex-row gap-4">
      {[1, 2, 3].map((i) => (
        <View key={i} className="flex-1 items-center rounded-[12px] bg-[#1e293b] p-4">
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
    <View className="mb-4 rounded-[12px] bg-[#1e293b] p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Skeleton width={22} height={22} borderRadius={11} />
          <View style={{ marginLeft: 12 }}>
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={10} style={{ marginTop: 4 }} />
          </View>
        </View>
        <View className="items-end">
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
    <View className="mb-4 overflow-hidden rounded-[12px] bg-[#1e293b]" style={style}>
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
        <View key={i} className="mb-4 flex-row items-center rounded-[12px] bg-[#1e293b] p-4">
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
    <View className="rounded-[12px] bg-[#1e293b] p-4" style={style}>
      <View className="mb-4 flex-row items-center justify-between">
        <Skeleton width={120} height={20} />
        <Skeleton width={60} height={14} />
      </View>
      <View className="mb-4 h-[180px] flex-row items-end justify-between">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} className="flex-1 items-center">
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
      <View className="mt-2 flex-row justify-around">
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
    <View className="relative flex-1" style={style}>
      <Skeleton width="100%" height="100%" borderRadius={0} />
      <View className="absolute right-4 top-8">
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
      <View className="absolute left-4 right-20 top-4">
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
    <View className="flex-1" style={style}>
      {/* Avatar and header */}
      <View className="items-center py-8">
        <Skeleton width={100} height={100} borderRadius={50} />
        <Skeleton width={150} height={24} style={{ marginTop: SPACING.md }} />
        <Skeleton width={200} height={14} style={{ marginTop: SPACING.xs }} />
      </View>

      {/* Stats row */}
      <View className="flex-row justify-around border-y border-[#334155] py-6">
        {[1, 2, 3].map((i) => (
          <View key={i} className="items-center">
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
      <View className="p-4">
        {[1, 2, 3, 4].map((i) => (
          <View key={i} className="border-b border-[#334155] py-4">
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
