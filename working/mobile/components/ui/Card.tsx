import React from "react";
import { View, Text, ViewStyle, TextStyle, StyleProp } from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Colors } from "../../lib/colors";

// ── Card ──────────────────────────────────────────────────────────────────────

/**
 * Card component with standardized styling matching web design system
 *
 * @param variant - Card style variant: 'default' (with shadow), 'outlined' (border only), 'elevated' (large shadow)
 * @param size - Card size affecting border radius: 'small' (4px), 'default' (8px), 'large' (12px)
 * @param shadow - Shadow intensity: 'none', 'sm' (subtle), 'md' (default), 'lg' (elevated)
 * @param padding - Padding size: 'compact' (12px), 'default' (16px), 'spacious' (20px), or custom number
 * @param children - Card content
 * @param style - Additional custom styles
 */
interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  variant?: "default" | "outlined" | "elevated";
  size?: "small" | "default" | "large";
  shadow?: "none" | "sm" | "md" | "lg";
  padding?: "compact" | "default" | "spacious" | number;
}

export function Card({
  children,
  style,
  className,
  variant = "default",
  size = "default",
  shadow = "md",
  padding = "default",
}: CardProps) {
  // Determine padding value
  const paddingValue =
    typeof padding === "number"
      ? padding
      : padding === "compact"
        ? 12
        : padding === "spacious"
          ? 20
          : 16; // default

  // Determine border radius based on size
  const borderRadius = size === "small" ? 4 : size === "large" ? 12 : 8;

  // Determine shadow style based on variant and shadow prop
  const shadowClass =
    variant === "outlined"
      ? ""
      : variant === "elevated"
        ? "shadow-lg"
        : shadow === "none"
          ? ""
          : shadow === "sm"
            ? "shadow-sm"
            : shadow === "lg"
              ? "shadow-lg"
              : "shadow-md";

  // Determine border style for outlined variant
  const borderStyle =
    variant === "outlined"
      ? { borderWidth: 1, borderColor: Colors.neutral[300] }
      : {};

  return (
    <View
      className={`bg-[#1e293b] rounded-[24px] border border-[#334155] ${shadowClass} ${className || ''}`}
      style={[
        { padding: paddingValue, borderRadius },
        borderStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: "sm" | "md";
}

export function Badge({
  label,
  color = COLORS.primary,
  textColor = "#fff",
  style,
  textStyle,
  size = "md",
}: BadgeProps) {
  return (
    <View
      className={`rounded-full self-start ${size === "sm" ? "px-[6px] py-[2px]" : "px-2 py-[3px]"}`}
      style={[
        { backgroundColor: color + "22" },
        style,
      ]}
    >
      <Text
        className={`font-semibold tracking-[0.2px] ${size === "sm" ? "text-[10px]" : "text-[10px]"}`}
        style={[
          { color },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider({ style }: { style?: ViewStyle }) {
  return <View className="h-[1px] bg-[#334155] my-4" style={style} />;
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
  style?: ViewStyle;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  accentColor,
  style,
  className,
}: StatCardProps) {
  return (
    <View className={`bg-[#1e293b] rounded-2xl border border-[#334155] p-2 items-start ${className || ''}`} style={style}>
      <View className="w-9 h-9 rounded-lg items-center justify-center mb-1" style={{ backgroundColor: accentColor + "20" }}>
        {icon}
      </View>
      <Text className="text-[10px] color-[#94a3b8] font-medium mb-[2px] tracking-[0.3px] uppercase">{label}</Text>
      <Text className="text-[20px] color-[#f8fafc] font-bold">{value}</Text>
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export function SectionHeader({ title, subtitle, style }: SectionHeaderProps) {
  return (
    <View className="mb-2" style={style}>
      <Text className="text-[20px] color-[#f8fafc] font-bold">{title}</Text>
      {subtitle && <Text className="text-[12px] color-[#94a3b8] mt-1">{subtitle}</Text>}
    </View>
  );
}
