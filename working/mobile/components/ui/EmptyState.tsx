import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "./Button";
import { COLORS, FONTS, SPACING } from "../../lib/constants";

/**
 * EmptyState Component
 *
 * A reusable component for displaying empty states across the application.
 * Provides consistent styling and behavior for scenarios where no data is available.
 *
 * Usage Examples:
 *
 * 1. No Analyses (History Screen):
 *    <EmptyState
 *      icon={<Ionicons name="time-outline" size={48} color={COLORS.textMuted} />}
 *      title="No History Yet"
 *      description="Your catch analysis history will appear here. Upload images to get started!"
 *      action={{ label: "Upload Now", onPress: () => router.push("/(tabs)/") }}
 *    />
 *
 * 2. No Conversations (Chat Sidebar):
 *    <EmptyState
 *      icon={<Ionicons name="chatbubbles-outline" size={48} color={COLORS.textMuted} />}
 *      title="No Conversations Yet"
 *      description="Start a new chat to get fishing advice, market insights, and catch analysis."
 *      action={{ label: "New Chat", onPress: createNewChat }}
 *    />
 *
 * 3. No Analytics Data:
 *    <EmptyState
 *      icon={<Ionicons name="bar-chart-outline" size={64} color={COLORS.textMuted} />}
 *      title="No Analytics Data"
 *      description="Upload and analyze catches to see your dashboard. Your earnings, catch statistics, and insights will appear here."
 *      action={{ label: "Upload Catch", onPress: () => router.push("/(tabs)/") }}
 *    />
 *
 * 4. No Notifications (Future):
 *    <EmptyState
 *      icon={<Ionicons name="notifications-outline" size={48} color={COLORS.textMuted} />}
 *      title="No Notifications"
 *      description="You're all caught up! Notifications about disaster alerts, analysis results, and updates will appear here."
 *    />
 *
 * 5. Search No Results (Future):
 *    <EmptyState
 *      icon={<Ionicons name="search-outline" size={48} color={COLORS.textMuted} />}
 *      title="No Results Found"
 *      description="Try adjusting your search terms or filters to find what you're looking for."
 *      action={{ label: "Clear Filters", onPress: clearFilters }}
 *    />
 */

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="primary"
          size="md"
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING["2xl"],
  },
  iconContainer: {
    marginBottom: SPACING.lg,
    opacity: 0.6,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  button: {
    marginTop: SPACING.sm,
  },
});
