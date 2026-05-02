/**
 * Offline Feature Message
 * Displays informative message when a feature requires internet connectivity
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface OfflineFeatureMessageProps {
  featureName: string;
  message?: string;
}

export function OfflineFeatureMessage({
  featureName,
  message,
}: OfflineFeatureMessageProps) {
  const defaultMessage = `${featureName} requires an active internet connection to provide real-time updates and accurate functionality. Please check your network settings.`;

  return (
    <View style={styles.container}>
      <View style={styles.blurContainer}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={64}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.title}>You are offline</Text>
          <Text style={styles.description}>{message || defaultMessage}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  blurContainer: {
    width: "100%",
    maxWidth: 400,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: "rgba(30,30,40,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  content: {
    padding: SPACING.xl,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: SPACING.md,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  title: {
    fontWeight: FONTS.weights.bold as any,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  description: {
    fontWeight: FONTS.weights.normal as any,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
