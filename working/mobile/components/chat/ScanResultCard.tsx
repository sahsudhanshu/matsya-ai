/**
 * ScanResultCard - Rich card showing scan results in chat after post-scan
 * agent takeover. Displays species, weight, value, and quick action buttons.
 */
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, FONTS } from "../../lib/constants";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface Detection {
  species: string;
  weight: number;
  quality: string;
  healthy: boolean;
}

interface Props {
  fishCount: number;
  detections: Detection[];
  totalValue: number;
  bestPort?: string;
  bestPortGain?: number;
  onAction?: (action: string) => void;
}

export function ScanResultCard({
  fishCount,
  detections,
  totalValue,
  bestPort,
  bestPortGain,
  onAction,
}: Props) {
  // Group by species
  const speciesMap = new Map<string, { count: number; totalWeight: number }>();
  detections.forEach((d) => {
    const existing = speciesMap.get(d.species) || { count: 0, totalWeight: 0 };
    speciesMap.set(d.species, {
      count: existing.count + 1,
      totalWeight: existing.totalWeight + d.weight,
    });
  });

  const allHealthy = detections.every((d) => d.healthy);
  const hasDisease = detections.some((d) => !d.healthy);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="fish" size={18} color="#fff" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Scan Complete</Text>
          <Text style={styles.subtitle}>{fishCount} fish detected</Text>
        </View>
        <View
          style={[
            styles.healthBadge,
            hasDisease ? styles.healthBadgeDanger : styles.healthBadgeOk,
          ]}
        >
          <Ionicons
            name={hasDisease ? "alert-circle" : "checkmark-circle"}
            size={12}
            color={hasDisease ? COLORS.error : COLORS.success}
          />
          <Text
            style={[
              styles.healthText,
              hasDisease ? styles.healthTextDanger : styles.healthTextOk,
            ]}
          >
            {allHealthy ? "All Healthy" : "Disease Found"}
          </Text>
        </View>
      </View>

      {/* Species breakdown */}
      <View style={styles.speciesList}>
        {Array.from(speciesMap.entries()).map(([species, data]) => (
          <View key={species} style={styles.speciesRow}>
            <View style={styles.speciesDot} />
            <Text style={styles.speciesName}>{species}</Text>
            <Text style={styles.speciesCount}>× {data.count}</Text>
            <Text style={styles.speciesWeight}>
              ({data.totalWeight.toFixed(1)}kg)
            </Text>
          </View>
        ))}
      </View>

      {/* Value + port */}
      <View style={styles.valueLine}>
        <View style={styles.valueItem}>
          <Ionicons name="cash" size={14} color={COLORS.secondaryLight} />
          <Text style={styles.valueLabel}>Est. Value:</Text>
          <Text style={styles.valueAmount}>₹{Math.round(totalValue)}</Text>
        </View>
        {bestPort && (
          <View style={styles.valueItem}>
            <Ionicons name="boat" size={14} color={COLORS.accent} />
            <Text style={styles.valueLabel}>Best port:</Text>
            <Text style={styles.portName}>{bestPort}</Text>
            {bestPortGain !== undefined && bestPortGain > 0 && (
              <Text style={styles.portGain}>
                (+₹{Math.round(bestPortGain)})
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.actions}>
        {[
          {
            key: "ask",
            label: "Ask about this catch",
            icon: "chatbubble" as IoniconName,
          },
          {
            key: "buyers",
            label: "Find buyers",
            icon: "people" as IoniconName,
          },
          {
            key: "compare",
            label: "Compare ports",
            icon: "swap-horizontal" as IoniconName,
          },
        ].map((a) => (
          <TouchableOpacity
            key={a.key}
            style={styles.actionBtn}
            onPress={() => onAction?.(a.key)}
            activeOpacity={0.75}
          >
            <Ionicons name={a.icon} size={13} color={COLORS.primaryLight} />
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  healthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  healthBadgeOk: { backgroundColor: COLORS.success + "18" },
  healthBadgeDanger: { backgroundColor: COLORS.error + "18" },
  healthText: { fontSize: 10, fontWeight: "600" },
  healthTextOk: { color: COLORS.success },
  healthTextDanger: { color: COLORS.error },

  speciesList: { padding: 14, gap: 4 },
  speciesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  speciesDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primaryLight,
  },
  speciesName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  speciesCount: { fontSize: 12, color: COLORS.textMuted },
  speciesWeight: { fontSize: 12, color: COLORS.textSubtle },

  valueLine: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
  },
  valueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  valueLabel: { fontSize: 12, color: COLORS.textMuted },
  valueAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondaryLight,
  },
  portName: { fontSize: 12, fontWeight: "600", color: COLORS.textPrimary },
  portGain: { fontSize: 12, fontWeight: "600", color: COLORS.success },

  actions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
  },
  actionText: { fontSize: 11, color: COLORS.primaryLight, fontWeight: "600" },
});
