import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyles: any[] = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style ?? {},
  ];

  const labelStyles: any[] = [
    styles.label,
    styles[`labelSize_${size}`],
    styles[`labelVariant_${variant}`],
    textStyle ?? {},
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={containerStyles}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "outline" || variant === "ghost"
              ? COLORS.primary
              : "#fff"
          }
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === "left" && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          <Text style={labelStyles}>{label}</Text>
          {icon && iconPosition === "right" && (
            <View style={styles.iconRight}>{icon}</View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  fullWidth: { width: "100%" },
  content: { flexDirection: "row", alignItems: "center" },
  iconLeft: { marginRight: SPACING.sm },
  iconRight: { marginLeft: SPACING.sm },
  disabled: { opacity: 0.5 },

  // Sizes
  size_sm: { paddingHorizontal: SPACING.sm, paddingVertical: 6, minHeight: 30 },
  size_md: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    minHeight: 40,
  },
  size_lg: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    minHeight: 46,
  },

  // Variants
  variant_primary: { backgroundColor: COLORS.primary },
  variant_secondary: { backgroundColor: COLORS.secondary },
  variant_outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  variant_ghost: { backgroundColor: "rgba(30,64,175,0.1)" },
  variant_danger: { backgroundColor: COLORS.error },

  // Labels
  label: { fontWeight: FONTS.weights.semibold, letterSpacing: 0.2 },
  labelSize_sm: { fontSize: FONTS.sizes.sm },
  labelSize_md: { fontSize: FONTS.sizes.base },
  labelSize_lg: { fontSize: FONTS.sizes.md },

  labelVariant_primary: { color: "#fff" },
  labelVariant_secondary: { color: "#fff" },
  labelVariant_outline: { color: COLORS.primary },
  labelVariant_ghost: { color: COLORS.primary },
  labelVariant_danger: { color: "#fff" },
});
