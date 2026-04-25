/**
 * Offline Feature Message
 * Displays informative message when a feature requires internet connectivity
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface OfflineFeatureMessageProps {
  featureName: string;
  message?: string;
}

export function OfflineFeatureMessage({
  featureName,
  message,
}: OfflineFeatureMessageProps) {
  const defaultMessage = `${featureName} requires an internet connection. Please connect to use this feature.`;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="cloud-offline" size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.title}>Offline Mode</Text>
      <Text style={styles.message}>{message || defaultMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
