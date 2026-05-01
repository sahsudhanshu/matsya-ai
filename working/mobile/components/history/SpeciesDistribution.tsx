import React from "react";
import { View, Text } from "react-native";

interface SpeciesDistributionProps {
  distribution: Record<string, number>;
}

export function SpeciesDistribution({
  distribution,
}: SpeciesDistributionProps) {
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <View className="bg-bgCard rounded-lg p-md mb-md border border-borderDark">
      <Text className="text-sm font-bold text-textPrimary mb-sm">Species Distribution</Text>

      {entries.map(([species, count]) => {
        const percentage = (count / total) * 100;

        return (
          <View key={species} className="flex-row items-center mb-sm gap-sm">
            <View className="w-[100px]">
              <Text className="text-sm font-semibold text-textPrimary">{species}</Text>
              <Text className="text-xs text-textMuted">{count} fish</Text>
            </View>

            <View className="flex-1 h-2 bg-bgSurface rounded-full overflow-hidden">
              <View className="h-full bg-primaryLight rounded-full" style={{ width: `${percentage}%` }} />
            </View>

            <Text className="text-xs font-semibold text-textSecondary w-[35px] text-right">{percentage.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}
