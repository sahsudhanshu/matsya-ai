import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { COLORS } from "../../lib/constants";

interface BadgeProps {
  label: string;
  variant: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  style?: ViewStyle;
  className?: string;
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
  className,
}: BadgeProps) {
  const color = VARIANT_COLORS[variant];

  return (
    <View
      style={[{ backgroundColor: `${color}22` }, style]}
      className={`flex-row flex-wrap items-center rounded-full self-start ${
        size === "sm" ? "px-1.5 py-0.5" : "px-3 py-1"
      } ${className || ""}`}
    >
      {icon && <View className="mr-1">{icon}</View>}
      <Text
        style={{ color }}
        className={`font-semibold tracking-wide ${
          size === "sm" ? "text-[10px]" : "text-xs"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
