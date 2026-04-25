/**
 * InlineUploadCard - A camera/upload CTA card rendered inside a chat bubble
 * when the agent returns ui.upload = true.
 */
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS, FONTS, RADIUS } from "../../lib/constants";

interface Props {
  onUploadComplete?: () => void;
}

export function InlineUploadCard({ onUploadComplete }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="camera" size={22} color="#fff" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Scan Your Catch</Text>
          <Text style={styles.subtitle}>
            Take a photo or pick from gallery for instant AI analysis
          </Text>
        </View>
      </View>
      <View style={styles.features}>
        {[
          { icon: "fish" as const, text: "Species ID" },
          { icon: "medkit" as const, text: "Disease Check" },
          { icon: "scale" as const, text: "Weight Est." },
          { icon: "cash" as const, text: "Market Value" },
        ].map((f) => (
          <View key={f.text} style={styles.featureChip}>
            <Ionicons name={f.icon} size={11} color={COLORS.primaryLight} />
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.scanBtn}
        onPress={() => router.push("/(tabs)/upload")}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={18} color="#fff" />
        <Text style={styles.scanBtnText}>Open Camera</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  features: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featureText: {
    fontSize: 11,
    color: COLORS.primaryLight,
    fontWeight: "500",
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
