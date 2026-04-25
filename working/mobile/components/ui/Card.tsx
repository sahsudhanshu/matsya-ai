import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from "react-native";
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
  variant?: "default" | "outlined" | "elevated";
  size?: "small" | "default" | "large";
  shadow?: "none" | "sm" | "md" | "lg";
  padding?: "compact" | "default" | "spacious" | number;
}

export function Card({
  children,
  style,
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
  const shadowStyle =
    variant === "outlined"
      ? {}
      : variant === "elevated"
        ? styles.shadowLg
        : shadow === "none"
          ? {}
          : shadow === "sm"
            ? styles.shadowSm
            : shadow === "lg"
              ? styles.shadowLg
              : styles.shadowMd;

  // Determine border style for outlined variant
  const borderStyle =
    variant === "outlined"
      ? { borderWidth: 1, borderColor: Colors.neutral[300] }
      : {};

  return (
    <View
      style={[
        styles.card,
        { padding: paddingValue, borderRadius },
        shadowStyle,
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
      style={[
        styles.badge,
        { backgroundColor: color + "22" },
        size === "sm" && styles.badgeSm,
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color },
          size === "sm" && styles.badgeTextSm,
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
  return <View style={[styles.divider, style]} />;
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  icon,
  accentColor,
  style,
}: StatCardProps) {
  return (
    <View style={[styles.statCard, style]}>
      <View style={[styles.statIcon, { backgroundColor: accentColor + "20" }]}>
        {icon}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS["2xl"],
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Shadow variants matching web design system
  shadowSm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shadowMd: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shadowLg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  // Badge
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.2,
  },
  badgeTextSm: {
    fontSize: 10,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },

  // StatCard
  statCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
    marginBottom: 2,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },

  // Section Header
  sectionHeader: {
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },
  sectionSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});
