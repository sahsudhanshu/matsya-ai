/**
 * Network Status Banner
 * Displays offline mode banner and connection quality indicator
 */
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetwork } from "../../lib/network-context";
import { SPACING } from "../../lib/constants";

export function NetworkStatusBanner() {
  const { isOnline, connectionQuality, effectiveMode } = useNetwork();
  const insets = useSafeAreaInsets();

  // Don't show banner if online with good connection
  if (isOnline && connectionQuality !== "poor" && effectiveMode === "online") {
    return null;
  }

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: "cloud-offline" as const,
        color: "#EF4444",
        text: "You're offline",
        subtext: "Changes will sync when you're back online",
      };
    }

    if (connectionQuality === "poor") {
      return {
        icon: "warning" as const,
        color: "#F59E0B",
        text: "Slow connection",
        subtext: "Using offline mode for better experience",
      };
    }

    return null;
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <View
      className="border-b border-[#E5E7EB] px-4 py-2"
      style={{
        backgroundColor: `${config.color}15`,
        paddingTop: insets.top + SPACING.sm,
      }}
    >
      <View className="flex-row items-center gap-4">
        <Ionicons name={config.icon} size={20} color={config.color} />
        <View className="flex-1">
          <Text className="mb-0.5 text-xs font-semibold" style={{ color: config.color }}>
            {config.text}
          </Text>
          <Text className="text-[11px] text-[#6B7280]">{config.subtext}</Text>
        </View>
      </View>
    </View>
  );
}
