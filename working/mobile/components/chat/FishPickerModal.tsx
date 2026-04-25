/**
 * FishPickerModal - Select which fish from a scan to measure for weight estimation.
 * Shows a list of detected fish with species, confidence, and measurement status.
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "../ui/Modal";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

export interface FishItem {
  index: number;
  species: string;
  confidence: number;
  diseaseStatus: string;
  cropUrl?: string;
  /** Already measured weight in grams, or null if not yet measured */
  measuredWeightG: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectFish: (fishIndex: number, species: string) => void;
  fish: FishItem[];
}

export function FishPickerModal({
  visible,
  onClose,
  onSelectFish,
  fish,
}: Props) {
  const measuredCount = fish.filter((f) => f.measuredWeightG !== null).length;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Select Fish to Weigh"
      size="md"
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {measuredCount} of {fish.length} fish measured
        </Text>
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {fish.map((item) => {
          const isMeasured = item.measuredWeightG !== null;
          return (
            <TouchableOpacity
              key={item.index}
              style={[styles.fishRow, isMeasured && styles.fishRowMeasured]}
              onPress={() => onSelectFish(item.index, item.species)}
              activeOpacity={0.7}
            >
              {item.cropUrl ? (
                <Image
                  source={{ uri: item.cropUrl }}
                  style={styles.fishThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.fishThumb, styles.fishThumbPlaceholder]}>
                  <Ionicons name="fish" size={20} color={COLORS.primaryLight} />
                </View>
              )}
              <View style={styles.fishInfo}>
                <Text style={styles.fishLabel}>Fish #{item.index + 1}</Text>
                <Text style={styles.fishSpecies}>{item.species}</Text>
                <Text style={styles.fishMeta}>
                  {(item.confidence * 100).toFixed(0)}% conf ·{" "}
                  {item.diseaseStatus}
                </Text>
              </View>
              <View style={styles.fishAction}>
                {isMeasured ? (
                  <View style={styles.measuredBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={COLORS.success}
                    />
                    <Text style={styles.measuredText}>
                      {(item.measuredWeightG! / 1000).toFixed(2)} kg
                    </Text>
                  </View>
                ) : (
                  <View style={styles.measureBadge}>
                    <Ionicons
                      name="scale-outline"
                      size={16}
                      color={COLORS.primaryLight}
                    />
                    <Text style={styles.measureText}>Measure</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {measuredCount > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total Measured Weight</Text>
          <Text style={styles.summaryValue}>
            {(
              fish
                .filter((f) => f.measuredWeightG !== null)
                .reduce((sum, f) => sum + f.measuredWeightG!, 0) / 1000
            ).toFixed(2)}{" "}
            kg
          </Text>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  fishRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fishRowMeasured: {
    borderColor: COLORS.success + "40",
    backgroundColor: COLORS.success + "08",
  },
  fishThumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  fishThumbPlaceholder: {
    backgroundColor: COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
  },
  fishInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  fishLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  fishSpecies: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    fontWeight: "600" as const,
  },
  fishMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
  },
  fishAction: {
    marginLeft: SPACING.sm,
  },
  measuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.success + "18",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  measuredText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.success,
    fontWeight: "600" as const,
  },
  measureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primaryLight + "18",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  measureText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primaryLight,
    fontWeight: "600" as const,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: "500" as const,
  },
  summaryValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primaryLight,
    fontWeight: "700" as const,
  },
});
