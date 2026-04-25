/**
 * Color System - Mobile Application
 *
 * This file defines the complete color palette for the Matsya AI mobile application,
 * matching the web application's color scheme for design consistency.
 *
 * Usage:
 * ```typescript
 * import { Colors } from '@/lib/colors';
 *
 * <View style={{ backgroundColor: Colors.primary[500] }}>
 * <Text style={{ color: Colors.neutral[700] }}>Hello</Text>
 * ```
 */

/**
 * Primary Color Palette (Blue)
 * Used for brand identity, primary actions, and key UI elements
 */
const primary = {
  50: "#e6f7ff",
  100: "#bae7ff",
  500: "#1890ff", // Main brand color
  600: "#096dd9",
  700: "#0050b3",
} as const;

/**
 * Secondary Color Palette (Green)
 * Used for success states, positive feedback, and secondary actions
 */
const secondary = {
  500: "#52c41a", // Success/positive
  600: "#389e0d",
} as const;

/**
 * Danger Color Palette (Red)
 * Used for errors, warnings, destructive actions, and critical alerts
 */
const danger = {
  500: "#ff4d4f", // Error/warning
  600: "#cf1322",
} as const;

/**
 * Neutral Color Palette (Gray Scale)
 * Used for text, borders, backgrounds, and general UI elements
 */
const neutral = {
  50: "#fafafa",
  100: "#f5f5f5",
  200: "#e8e8e8",
  300: "#d9d9d9",
  500: "#8c8c8c",
  700: "#434343",
  900: "#141414",
} as const;

/**
 * Background Colors
 * Used for page backgrounds and surface colors
 */
const background = {
  light: "#ffffff",
  dark: "#001529",
} as const;

/**
 * Semantic Colors
 * Predefined colors for common UI states and feedback
 */
const semantic = {
  /** Success state - operations completed successfully */
  success: "#52c41a",

  /** Warning state - caution or attention needed */
  warning: "#faad14",

  /** Error state - operation failed or invalid input */
  error: "#ff4d4f",

  /** Info state - informational messages */
  info: "#1890ff",
} as const;

/**
 * Quality Grade Colors
 * Used for fish quality assessment visualization
 */
const quality = {
  /** Premium quality - highest grade */
  premium: "#52c41a",

  /** Good quality - above average */
  good: "#1890ff",

  /** Fair quality - acceptable */
  fair: "#faad14",

  /** Poor quality - below standard */
  poor: "#ff4d4f",
} as const;

/**
 * Alert Severity Colors
 * Used for disaster alerts and safety warnings on the map
 */
const alert = {
  /** Low severity - minimal risk */
  low: "#52c41a",

  /** Medium severity - moderate risk */
  medium: "#faad14",

  /** High severity - significant risk */
  high: "#ff7a45",

  /** Critical severity - extreme danger */
  critical: "#ff4d4f",
} as const;

/**
 * Overlay Colors
 * Semi-transparent colors for modals, overlays, and dimmed backgrounds
 */
const overlay = {
  /** Dark overlay for modals */
  dark: "rgba(0, 21, 41, 0.8)",

  /** Light overlay for cards */
  light: "rgba(255, 255, 255, 0.95)",

  /** Semi-transparent black */
  black: "rgba(0, 0, 0, 0.5)",
} as const;

/**
 * Complete Color System
 * Organized object containing all color palettes
 */
export const Colors = {
  primary,
  secondary,
  danger,
  neutral,
  background,
  semantic,
  quality,
  alert,
  overlay,
  // Common colors
  white: "#ffffff",
  black: "#000000",
} as const;

/**
 * Legacy color constants for backward compatibility
 * @deprecated Use Colors object instead (e.g., Colors.primary[500])
 */
export const LEGACY_COLORS = {
  // Primary ocean blue
  primary: primary[700],
  primaryLight: primary[500],
  primaryDark: "#0f3460",

  // Secondary forest green
  secondary: secondary[600],
  secondaryLight: secondary[500],

  // Accent warm gold
  accent: "#d97706",
  accentLight: semantic.warning,

  // Backgrounds
  bgDark: background.dark,
  bgCard: "#1e293b",
  bgSurface: "#334155",

  // Text
  textPrimary: "#f8fafc",
  textSecondary: "#e2e8f0",
  textMuted: "#94a3b8",
  textSubtle: neutral[500],

  // Borders
  border: "#334155",
  borderLight: "#475569",

  // Status colors
  success: semantic.success,
  warning: semantic.warning,
  error: semantic.error,
  info: semantic.info,

  // Quality grades
  premium: quality.premium,
  standard: quality.fair,
  low: quality.poor,

  // Transparent
  overlay: overlay.dark,
  cardOverlay: overlay.light,
} as const;

/**
 * Type definitions for color values
 */
export type PrimaryColor = keyof typeof primary;
export type SecondaryColor = keyof typeof secondary;
export type DangerColor = keyof typeof danger;
export type NeutralColor = keyof typeof neutral;
export type BackgroundColor = keyof typeof background;
export type SemanticColor = keyof typeof semantic;
export type QualityColor = keyof typeof quality;
export type AlertColor = keyof typeof alert;
export type OverlayColor = keyof typeof overlay;
