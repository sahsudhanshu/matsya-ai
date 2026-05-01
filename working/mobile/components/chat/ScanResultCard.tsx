/**
 * ScanResultCard - Rich card showing scan results in chat after post-scan
 * agent takeover. Displays species, weight, value, and quick action buttons.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface Detection {
  species: string;
  weight: number;
  quality: string;
  healthy: boolean;
}

interface Props {
  fishCount: number;
  detections: Detection[];
  totalValue: number;
  bestPort?: string;
  bestPortGain?: number;
  onAction?: (action: string) => void;
}

export function ScanResultCard({
  fishCount,
  detections,
  totalValue,
  bestPort,
  bestPortGain,
  onAction,
}: Props) {
  // Group by species
  const speciesMap = new Map<string, { count: number; totalWeight: number }>();
  detections.forEach((d) => {
    const existing = speciesMap.get(d.species) || { count: 0, totalWeight: 0 };
    speciesMap.set(d.species, {
      count: existing.count + 1,
      totalWeight: existing.totalWeight + d.weight,
    });
  });

  const allHealthy = detections.every((d) => d.healthy);
  const hasDisease = detections.some((d) => !d.healthy);

  return (
    <View className="rounded-lg bg-bgCard border border-[#1e40af30] overflow-hidden mt-2 mb-1">
      {/* Header */}
      <View className="flex-row items-center gap-[10px] p-[14px] border-b border-borderDark">
        <View className="w-[36px] h-[36px] rounded-[10px] bg-primary items-center justify-center">
          <Ionicons name="fish" size={18} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-textPrimary">Scan Complete</Text>
          <Text className="text-[12px] text-textMuted">{fishCount} fish detected</Text>
        </View>
        <View
          className={`flex-row items-center gap-1 rounded-full px-[10px] py-1 ${
            hasDisease ? "bg-[#ef444418]" : "bg-[#10b98118]"
          }`}
        >
          <Ionicons
            name={hasDisease ? "alert-circle" : "checkmark-circle"}
            size={12}
            color={hasDisease ? COLORS.error : COLORS.success}
          />
          <Text
            className={`text-[10px] font-semibold ${
              hasDisease ? "text-error" : "text-success"
            }`}
          >
            {allHealthy ? "All Healthy" : "Disease Found"}
          </Text>
        </View>
      </View>

      {/* Species breakdown */}
      <View className="p-[14px] gap-1">
        {Array.from(speciesMap.entries()).map(([species, data]) => (
          <View key={species} className="flex-row items-center gap-[6px]">
            <View className="w-[6px] h-[6px] rounded-full bg-primaryLight" />
            <Text className="flex-1 text-[13px] font-semibold text-textPrimary">{species}</Text>
            <Text className="text-[12px] text-textMuted">× {data.count}</Text>
            <Text className="text-[12px] text-textSubtle">
              ({data.totalWeight.toFixed(1)}kg)
            </Text>
          </View>
        ))}
      </View>

      {/* Value + port */}
      <View className="px-[14px] pb-3 gap-[6px]">
        <View className="flex-row items-center gap-[6px]">
          <Ionicons name="cash" size={14} color={COLORS.secondaryLight} />
          <Text className="text-[12px] text-textMuted">Est. Value:</Text>
          <Text className="text-[14px] font-bold text-secondaryLight">₹{Math.round(totalValue)}</Text>
        </View>
        {bestPort && (
          <View className="flex-row items-center gap-[6px]">
            <Ionicons name="boat" size={14} color={COLORS.accent} />
            <Text className="text-[12px] text-textMuted">Best port:</Text>
            <Text className="text-[12px] font-semibold text-textPrimary">{bestPort}</Text>
            {bestPortGain !== undefined && bestPortGain > 0 && (
              <Text className="text-[12px] font-semibold text-success">
                (+₹{Math.round(bestPortGain)})
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Quick actions */}
      <View className="flex-row border-t border-borderDark">
        {[
          {
            key: "ask",
            label: "Ask about this catch",
            icon: "chatbubble" as IoniconName,
          },
          {
            key: "buyers",
            label: "Find buyers",
            icon: "people" as IoniconName,
          },
          {
            key: "compare",
            label: "Compare ports",
            icon: "swap-horizontal" as IoniconName,
          },
        ].map((a) => (
          <TouchableOpacity
            key={a.key}
            className="flex-1 flex-row items-center justify-center gap-[5px] py-[10px] border-r border-borderDark"
            onPress={() => onAction?.(a.key)}
            activeOpacity={0.75}
          >
            <Ionicons name={a.icon} size={13} color={COLORS.primaryLight} />
            <Text className="text-[11px] text-primaryLight font-semibold">{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
