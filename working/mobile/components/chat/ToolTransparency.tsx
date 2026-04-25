/**
 * ToolTransparency - Shows live progress of agent tool calls during streaming.
 *
 * Renders a compact list of tool names with check/spinner icons as each tool
 * executes, building user trust by showing the agent is "doing real work."
 */
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../../lib/constants";

/** Friendly display names for agent tools */
const TOOL_NAMES: Record<string, { label: string; icon: string }> = {
  get_weather: { label: "Checking weather", icon: "cloudy" },
  get_catch_history: { label: "Reviewing catch history", icon: "time" },
  get_catch_details: { label: "Loading catch details", icon: "fish" },
  get_group_history: { label: "Loading group history", icon: "images" },
  get_group_details: { label: "Loading group details", icon: "layers" },
  get_map_data: { label: "Scanning map data", icon: "map" },
  get_market_prices: { label: "Fetching market prices", icon: "cash" },
  get_nearby_fishing_spots: {
    label: "Finding fishing spots",
    icon: "navigate",
  },
  web_search: { label: "Searching the web", icon: "globe" },
};

interface Props {
  /** Tool names that have been called so far (in order) */
  toolsCalled: string[];
  /** Whether the agent is still working (show spinner on last tool) */
  isWorking: boolean;
}

export function ToolTransparency({ toolsCalled, isWorking }: Props) {
  if (toolsCalled.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={12} color={COLORS.primaryLight} />
        <Text style={styles.headerText}>SagarMitra is working...</Text>
      </View>
      {toolsCalled.map((tool, i) => {
        const meta = TOOL_NAMES[tool] || {
          label: tool.replace(/_/g, " "),
          icon: "construct",
        };
        const isLast = i === toolsCalled.length - 1;
        const isDone = !isLast || !isWorking;

        return (
          <View key={`${tool}_${i}`} style={styles.toolRow}>
            {isDone ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={COLORS.success}
              />
            ) : (
              <ActivityIndicator size={14} color={COLORS.primaryLight} />
            )}
            <Ionicons
              name={meta.icon as any}
              size={12}
              color={COLORS.textMuted}
            />
            <Text style={[styles.toolLabel, isDone && styles.toolLabelDone]}>
              {meta.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Collapsed badge showing "Used N tools" after completion */
export function ToolsBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Ionicons name="construct-outline" size={10} color={COLORS.textSubtle} />
      <Text style={styles.badgeText}>
        Used {count} tool{count > 1 ? "s" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primaryLight,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
    paddingLeft: 4,
  },
  toolLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  toolLabelDone: {
    color: COLORS.textSubtle,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    color: COLORS.textSubtle,
  },
});
