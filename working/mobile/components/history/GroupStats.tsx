import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

interface GroupStatsProps {
  stats: {
    totalFishCount: number;
    speciesCount: number;
    totalWeight: number;
    totalValue: number;
    diseaseDetected: boolean;
  };
}

export function GroupStats({ stats }: GroupStatsProps) {
  return (
    <View className="mb-md">
      <View className="flex-row flex-wrap gap-sm">
        <View className="flex-1 min-w-[47%] bg-bgCard rounded-lg p-sm items-center border border-borderDark">
          <Ionicons name="fish" size={32} color={COLORS.primary} />
          <Text className="text-base font-bold text-textPrimary my-xs">{stats.totalFishCount}</Text>
          <Text className="text-xs text-textMuted text-center">Total Fish</Text>
        </View>

        <View className="flex-1 min-w-[47%] bg-bgCard rounded-lg p-sm items-center border border-borderDark">
          <Ionicons name="list" size={32} color={COLORS.secondary} />
          <Text className="text-base font-bold text-textPrimary my-xs">{stats.speciesCount}</Text>
          <Text className="text-xs text-textMuted text-center">Species</Text>
        </View>

        <View className="flex-1 min-w-[47%] bg-bgCard rounded-lg p-sm items-center border border-borderDark">
          <Ionicons name="scale" size={24} color={COLORS.success} />
          <Text className="text-base font-bold text-textPrimary my-xs">
            {stats.totalWeight.toFixed(1)} kg
          </Text>
          <Text className="text-xs text-textMuted text-center">Est. Weight</Text>
        </View>

        <View className="flex-1 min-w-[47%] bg-bgCard rounded-lg p-sm items-center border border-borderDark">
          <Ionicons name="cash" size={24} color={COLORS.warning} />
          <Text className="text-base font-bold text-textPrimary my-xs">₹{stats.totalValue.toFixed(0)}</Text>
          <Text className="text-xs text-textMuted text-center">Est. Value</Text>
        </View>
      </View>

      {stats.diseaseDetected && (
        <View className="flex-row items-center gap-md bg-error/15 rounded-lg p-md mt-sm border border-error/30">
          <Ionicons name="warning" size={24} color={COLORS.warning} />
          <View className="flex-1">
            <Text className="text-sm font-bold text-error mb-0.5">Disease Detected</Text>
            <Text className="text-xs text-textSecondary">
              Some fish show signs of disease. Review individual detections for
              details.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
