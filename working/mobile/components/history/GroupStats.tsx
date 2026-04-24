import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface GroupStatsProps {
  stats: {
    totalFishCount: number;
    speciesCount: number;
    totalWeight: number;
    totalValue: number;
    diseaseDetected: boolean;
  };
}

export function GroupStats({ stats }: GroupStatsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Ionicons name="fish" size={32} color={COLORS.primary} />
          <Text style={styles.statValue}>{stats.totalFishCount}</Text>
          <Text style={styles.statLabel}>Total Fish</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="list" size={32} color={COLORS.secondary} />
          <Text style={styles.statValue}>{stats.speciesCount}</Text>
          <Text style={styles.statLabel}>Species</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="scale" size={24} color={COLORS.success} />
          <Text style={styles.statValue}>
            {stats.totalWeight.toFixed(1)} kg
          </Text>
          <Text style={styles.statLabel}>Est. Weight</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="cash" size={24} color={COLORS.warning} />
          <Text style={styles.statValue}>₹{stats.totalValue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Est. Value</Text>
        </View>
      </View>

      {stats.diseaseDetected && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={24} color={COLORS.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Disease Detected</Text>
            <Text style={styles.warningText}>
              Some fish show signs of disease. Review individual detections for
              details.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.error + "15",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.error + "30",
  },
  warningTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
    marginBottom: 2,
  },
  warningText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
});
