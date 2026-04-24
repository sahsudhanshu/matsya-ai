/**
 * Network Status Banner
 * Displays offline mode banner and connection quality indicator
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
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
    <View style={[styles.banner, { backgroundColor: `${config.color}15`, paddingTop: insets.top + SPACING.sm }]}>
      <View style={styles.content}>
        <Ionicons name={config.icon} size={20} color={config.color} />
        <View style={styles.textContainer}>
          <Text style={[styles.text, { color: config.color }]}>
            {config.text}
          </Text>
          <Text style={styles.subtext}>{config.subtext}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  subtext: {
    fontSize: 11,
    color: "#6B7280",
  },
});
