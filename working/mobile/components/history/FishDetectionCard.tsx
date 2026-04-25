import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../ui/Card";

export interface FishDetection {
  cropUrl: string;
  species: string;
  confidence: number;
  diseaseStatus: string;
  diseaseConfidence: number;
  weight: number;
  value: number;
  gradcamUrls?: {
    species: string;
    disease: string;
  };
}

interface FishDetectionCardProps {
  detection: FishDetection;
  onExpand: () => void;
  expanded: boolean;
}

export function FishDetectionCard({
  detection,
  onExpand,
  expanded,
}: FishDetectionCardProps) {
  const isDiseased = !detection.diseaseStatus.toLowerCase().includes("healthy");

  return (
    <Card variant="default" padding={0} style={styles.cardContainer}>
      <View style={styles.mainContent}>
        {/* Fish Crop Image */}
        <Image
          source={{ uri: detection.cropUrl }}
          style={styles.cropImage}
          resizeMode="cover"
        />

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.species}>{detection.species}</Text>
          <Text style={styles.confidence}>
            {(detection.confidence * 100).toFixed(1)}% confident
          </Text>

          <View style={styles.row}>
            <View
              style={[
                styles.diseaseBadge,
                {
                  backgroundColor: isDiseased
                    ? COLORS.error + "20"
                    : COLORS.success + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.diseaseText,
                  { color: isDiseased ? COLORS.error : COLORS.success },
                ]}
              >
                {detection.diseaseStatus}
              </Text>
            </View>
          </View>

          <View style={styles.estimates}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name="scale-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text style={styles.estimate}>
                {detection.weight.toFixed(2)} kg
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name="cash-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text style={styles.estimate}>₹{detection.value.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {/* Expand Button */}
        {detection.gradcamUrls && (
          <TouchableOpacity style={styles.expandBtn} onPress={onExpand}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={COLORS.primaryLight}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded Grad-CAM View */}
      {expanded && detection.gradcamUrls && (
        <View style={styles.gradcamSection}>
          <Text style={styles.gradcamTitle}>Grad-CAM Visualizations</Text>

          <View style={styles.gradcamGrid}>
            <View style={styles.gradcamItem}>
              <Text style={styles.gradcamLabel}>Species Detection</Text>
              <Image
                source={{ uri: detection.gradcamUrls.species }}
                style={styles.gradcamImage}
                resizeMode="cover"
              />
            </View>

            <View style={styles.gradcamItem}>
              <Text style={styles.gradcamLabel}>Disease Detection</Text>
              <Image
                source={{ uri: detection.gradcamUrls.disease }}
                style={styles.gradcamImage}
                resizeMode="cover"
              />
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  mainContent: {
    flexDirection: "row",
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  cropImage: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgSurface,
  },
  info: {
    flex: 1,
  },
  species: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  confidence: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  diseaseBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diseaseText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  estimates: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  estimate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  expandBtn: {
    justifyContent: "center",
    alignItems: "center",
    width: 32,
  },
  gradcamSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.sm,
    backgroundColor: COLORS.bgSurface,
  },
  gradcamTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  gradcamGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  gradcamItem: {
    flex: 1,
  },
  gradcamLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  gradcamImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
  },
});
