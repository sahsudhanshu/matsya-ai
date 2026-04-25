import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../ui/Card";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Card padding={0} style={styles.card}>
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.medium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  card: {
    overflow: "hidden",
  },
});
