import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface PreferenceRowProps {
  label: string;
  description?: string;
  type: "toggle" | "select" | "text" | "action";
  value?: any;
  onValueChange?: (value: any) => void;
  onPress?: () => void;
  options?: Array<{ label: string; value: any }>;
  danger?: boolean;
}

export function PreferenceRow({
  label,
  description,
  type,
  value,
  onValueChange,
  onPress,
  danger,
}: PreferenceRowProps) {
  const renderControl = () => {
    switch (type) {
      case "toggle":
        return (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
            thumbColor={value ? COLORS.primary : COLORS.textSubtle}
          />
        );

      case "select":
        return (
          <View style={styles.selectControl}>
            <Text style={styles.selectValue}>{value || "Select"}</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
        );

      case "text":
        return (
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={onValueChange}
            placeholder="Enter value"
            placeholderTextColor={COLORS.textSubtle}
          />
        );

      case "action":
        return (
          <View style={styles.actionControl}>
            {value && <Text style={styles.actionValue}>{value}</Text>}
            <Text style={[styles.arrow, danger && styles.arrowDanger]}>
              {danger ? "→" : "›"}
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  const content = (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={[styles.label, danger && styles.labelDanger]}>
          {label}
        </Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <View style={styles.right}>{renderControl()}</View>
    </View>
  );

  if (type === "action" || type === "select") {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  left: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  labelDanger: {
    color: COLORS.error,
  },
  description: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    marginTop: 2,
  },
  selectControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  selectValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  arrow: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSubtle,
  },
  arrowDanger: {
    color: COLORS.error,
  },
  textInput: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    minWidth: 120,
    textAlign: "right",
  },
  actionControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  actionValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
});
