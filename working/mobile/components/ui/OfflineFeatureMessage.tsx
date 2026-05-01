/**
 * Offline Feature Message
 * Displays informative message when a feature requires internet connectivity
 */
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface OfflineFeatureMessageProps {
  featureName: string;
  message?: string;
}

export function OfflineFeatureMessage({
  featureName,
  message,
}: OfflineFeatureMessageProps) {
  const defaultMessage = `${featureName} requires an internet connection. Please connect to use this feature.`;

  return (
    <View className="flex-1 items-center justify-center p-6">
      <View className="mb-4">
        <Ionicons name="cloud-offline" size={48} color="#9CA3AF" />
      </View>
      <Text className="mb-2 text-sm font-semibold text-[#1F2937]">
        Offline Mode
      </Text>
      <Text className="text-center text-sm leading-5 text-[#6B7280]">
        {message || defaultMessage}
      </Text>
    </View>
  );
}
