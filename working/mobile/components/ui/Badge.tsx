import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface BadgeProps {
  label: string;
  variant: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const VARIANT_COLORS = {
  success: COLORS.success,
  warning: COLORS.warning,
  error: COLORS.error,
  info: COLORS.info,
  neutral: COLORS.textMuted,
};

export function Badge({
  label,
  variant,
  size = "md",
  icon,
  style,
}: BadgeProps) {
  const color = VARIANT_COLORS[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${color}22` },
        size === "sm" && styles.badgeSm,
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { color }, size === "sm" && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  icon: {
    marginRight: SPACING.xs,
  },
  text: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: 10,
  },
});
