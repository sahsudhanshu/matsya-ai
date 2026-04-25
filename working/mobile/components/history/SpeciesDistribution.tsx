import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface SpeciesDistributionProps {
  distribution: Record<string, number>;
}

export function SpeciesDistribution({
  distribution,
}: SpeciesDistributionProps) {
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Species Distribution</Text>

      {entries.map(([species, count]) => {
        const percentage = (count / total) * 100;

        return (
          <View key={species} style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.species}>{species}</Text>
              <Text style={styles.count}>{count} fish</Text>
            </View>

            <View style={styles.barContainer}>
              <View style={[styles.bar, { width: `${percentage}%` }]} />
            </View>

            <Text style={styles.percentage}>{percentage.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  info: {
    width: 100,
  },
  species: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  count: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
  },
  percentage: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    width: 35,
    textAlign: "right",
  },
});
