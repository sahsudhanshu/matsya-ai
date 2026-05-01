import React from "react";
import { View, Text } from "react-native";
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
  className?: string;
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
  className,
}: EmptyStateProps) {
  return (
    <View className={`flex-1 justify-center items-center p-8 ${className || ""}`}>
      <View className="mb-6 opacity-60">{icon}</View>
      <Text className="text-xl font-bold text-center text-textPrimary mb-2">{title}</Text>
      <Text className="text-base text-center text-textSecondary mb-6 leading-6">{description}</Text>
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="primary"
          size="md"
          className="min-w-[200px]"
        />
      )}
    </View>
  );
}
