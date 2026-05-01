/**
 * InlineCatchCarousel - Horizontal carousel of recent catches rendered inside
 * a chat bubble when the agent returns ui.history = true.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS } from "../../lib/constants";

interface CatchCard {
  groupId: string;
  fishCount: number;
  topSpecies: string;
  totalWeight: number;
  totalValue: number;
  createdAt: string;
  thumbnailUrl?: string;
}

interface Props {
  onAskAboutCatch?: (groupId: string, species: string) => void;
}

export function InlineCatchCarousel({ onAskAboutCatch }: Props) {
  const [catches, setCatches] = useState<CatchCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentCatches();
  }, []);

  const loadRecentCatches = async () => {
    try {
      const { getGroups } = await import("../../lib/api-client");
      const response = await getGroups(5);
      const cards: CatchCard[] = response.groups.map((g: any) => {
        const stats = g.analysisResult?.aggregateStats;
        const dist = stats?.speciesDistribution || {};
        const topSpecies =
          Object.entries(dist).sort(
            ([, a], [, b]) => (b as number) - (a as number),
          )[0]?.[0] || "Unknown";

        return {
          groupId: g.groupId,
          fishCount: stats?.totalFishCount ?? g.imageCount ?? 0,
          topSpecies,
          totalWeight: stats?.totalEstimatedWeight ?? 0,
          totalValue: stats?.totalEstimatedValue ?? 0,
          createdAt: g.createdAt,
          thumbnailUrl: undefined,
        };
      });
      setCatches(cards);
    } catch (err) {
      console.warn("Failed to load catches for carousel:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-row items-center gap-2 p-4 bg-bgCard rounded-md border border-borderDark mt-2">
        <ActivityIndicator size="small" color={COLORS.primaryLight} />
        <Text className="text-[12px] text-textMuted">Loading catches...</Text>
      </View>
    );
  }

  if (catches.length === 0) {
    return (
      <View className="items-center gap-[6px] p-4 bg-bgCard rounded-md border border-borderDark mt-2">
        <Ionicons name="fish-outline" size={24} color={COLORS.textSubtle} />
        <Text className="text-[12px] text-textMuted">No catches recorded yet</Text>
      </View>
    );
  }

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  return (
    <View className="rounded-md overflow-hidden bg-bgCard border border-borderDark mt-2 mb-1">
      <View className="flex-row items-center gap-[6px] px-[10px] py-2 border-b border-borderDark">
        <Ionicons name="time" size={14} color={COLORS.primaryLight} />
        <Text className="flex-1 text-[12px] font-semibold text-textPrimary">Recent Catches</Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/history")}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text className="text-[11px] font-semibold text-primaryLight">View All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={{ maxHeight: 250 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerClassName="px-2 py-2 gap-2"
      >
        {catches.map((c) => (
          <TouchableOpacity
            key={c.groupId}
            className="w-full bg-bgSurface rounded-sm p-[10px] border border-borderDark"
            onPress={() => onAskAboutCatch?.(c.groupId, c.topSpecies)}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-[6px] mb-[6px]">
              <View className="w-[28px] h-[28px] rounded-sm bg-[#1e40af20] items-center justify-center">
                <Ionicons name="fish" size={18} color={COLORS.primaryLight} />
              </View>
              <Text className="text-[11px] text-textMuted font-medium">{c.fishCount} fish</Text>
            </View>
            <Text className="text-[13px] font-bold text-textPrimary mb-1" numberOfLines={1}>
              {c.topSpecies}
            </Text>
            <View className="flex-row items-center gap-1 mb-1">
              <Text className="text-[11px] font-semibold text-secondaryLight">{c.totalWeight.toFixed(1)}kg</Text>
              <Text className="text-[11px] text-textSubtle">•</Text>
              <Text className="text-[11px] font-semibold text-secondaryLight">₹{Math.round(c.totalValue)}</Text>
            </View>
            <Text className="text-[10px] text-textSubtle">{formatDate(c.createdAt)}</Text>
            <View className="flex-row items-center gap-1 mt-[6px] bg-[#1e40af20] rounded-full px-2 py-[3px] self-start">
              <Ionicons
                name="chatbubble"
                size={10}
                color={COLORS.primaryLight}
              />
              <Text className="text-[9px] font-semibold text-primaryLight">Ask AI</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
