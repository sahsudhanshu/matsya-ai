/**
 * Connection Quality Icon
 * Shows connection quality with color-coded icon (green/yellow/red)
 */
import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../../lib/network-context";

interface ConnectionQualityIconProps {
  size?: number;
}

export function ConnectionQualityIcon({
  size = 20,
}: ConnectionQualityIconProps) {
  const { connectionQuality, isOnline } = useNetwork();

  const getQualityConfig = () => {
    if (!isOnline || connectionQuality === "offline") {
      return {
        icon: "cloud-offline" as const,
        color: "#EF4444", // Red
      };
    }

    switch (connectionQuality) {
      case "excellent":
        return {
          icon: "wifi" as const,
          color: "#10B981", // Green
        };
      case "good":
        return {
          icon: "wifi" as const,
          color: "#10B981", // Green
        };
      case "poor":
        return {
          icon: "wifi" as const,
          color: "#F59E0B", // Yellow/Orange
        };
      default:
        return {
          icon: "wifi" as const,
          color: "#6B7280", // Gray
        };
    }
  };

  const config = getQualityConfig();

  return (
    <View className="p-1">
      <Ionicons name={config.icon} size={size} color={config.color} />
    </View>
  );
}
