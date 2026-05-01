import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFishermanTools } from "../../lib/api-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { toastService } from "../../lib/toast-service";

interface FishermanToolsProps {
  location: { latitude: number; longitude: number };
  onRefresh?: () => void;
}

interface FishermanToolsData {
  location: { latitude: number; longitude: number };
  date: string;
  sunrise: string;
  sunset: string;
  moonPhase: {
    phase: string;
    illumination: number;
    icon: string;
  };
  tides: Array<{
    time: string;
    type: "high" | "low";
    height: number;
  }>;
  bestFishingTimes: Array<{
    start: string;
    end: string;
    quality: "good" | "better" | "best";
  }>;
}

export function FishermanTools({ location, onRefresh }: FishermanToolsProps) {
  const [data, setData] = useState<FishermanToolsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [location.latitude, location.longitude]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFishermanTools(
        location.latitude,
        location.longitude,
      );
      setData(result);
    } catch (err) {
      console.error("Failed to load fisherman tools data:", err);
      toastService.error("Failed to load fishing data.");
      setError(
        err instanceof Error ? err.message : "Failed to load fishing data",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
    onRefresh?.();
  };

  if (loading) {
    return (
      <View className="flex-1 p-4">
        <View className="mb-4 flex-row items-center gap-2">
          <Ionicons
            name="compass-outline"
            size={20}
            color={COLORS.primaryLight}
          />
          <Text className="text-[13px] font-bold text-[#f8fafc]">Fisherman Tools</Text>
        </View>
        <View className="items-center justify-center py-8">
          <ActivityIndicator size="small" color={COLORS.primaryLight} />
          <Text className="mt-2 text-[12px] text-[#94a3b8]">Loading fishing data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 p-4">
        <View className="mb-4 flex-row items-center gap-2">
          <Ionicons
            name="compass-outline"
            size={20}
            color={COLORS.primaryLight}
          />
          <Text className="text-[13px] font-bold text-[#f8fafc]">Fisherman Tools</Text>
        </View>
        <View className="items-center justify-center py-8">
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={COLORS.error}
          />
          <Text className="mt-2 text-center text-[12px] text-[#ef4444]">{error}</Text>
          <TouchableOpacity className="mt-4 rounded-[12px] bg-[#3b82f6] px-6 py-2" onPress={handleRefresh}>
            <Text className="text-[12px] font-bold text-[#f8fafc]">Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data) {
    return null;
  }

  // Get next tide
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const nextTide =
    data.tides.find((tide) => tide.time > currentTime) || data.tides[0];

  // Get current/next best fishing time
  const bestTime =
    data.bestFishingTimes.find((time) => time.end > currentTime) ||
    data.bestFishingTimes[0];

  // Format moon phase name
  const formatMoonPhase = (phase: string) => {
    return phase
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get quality color
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "best":
        return "#6ee7b7";
      case "better":
        return "#67e8f9";
      case "good":
        return "#fbbf24";
      default:
        return COLORS.textMuted;
    }
  };

  return (
    <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
      <View className="mb-4 flex-row items-center gap-2">
        <Ionicons
          name="compass-outline"
          size={20}
          color={COLORS.primaryLight}
        />
        <Text className="text-[13px] font-bold text-[#f8fafc]">Fisherman Tools</Text>
      </View>

      <View className="mb-4 flex-row flex-wrap gap-2">
        {/* Sunrise/Sunset */}
        <View className="w-[48%] rounded-[16px] border border-[#f59e0b30] bg-[#334155] p-2">
          <Ionicons
            name="sunny-outline"
            size={22}
            color="#fbbf24"
            style={{ marginBottom: 4 }}
          />
          <Text className="mt-1 text-[10px] font-bold text-[#fbbf24]">Sunrise</Text>
          <Text className="mt-0.5 text-[12px] font-bold text-[#f8fafc]">{data.sunrise}</Text>
          <Text className="mt-0.5 text-[10px] text-[#94a3b8]">Sunset {data.sunset}</Text>
        </View>

        {/* Moon Phase */}
        <View className="w-[48%] rounded-[16px] border border-[#818cf830] bg-[#334155] p-2">
          <Ionicons
            name="moon-outline"
            size={22}
            color="#a5b4fc"
            style={{ marginBottom: 4 }}
          />
          <Text className="mt-1 text-[10px] font-bold text-[#a5b4fc]">Moon</Text>
          <Text className="mt-0.5 text-[12px] font-bold text-[#f8fafc]">
            {formatMoonPhase(data.moonPhase.phase)}
          </Text>
          <Text className="mt-0.5 text-[10px] text-[#94a3b8]">
            {Math.round(data.moonPhase.illumination * 100)}% illuminated
          </Text>
        </View>

        {/* Tide Information */}
        <View className="w-[48%] rounded-[16px] border border-[#22d3ee30] bg-[#334155] p-2">
          <Ionicons
            name="water-outline"
            size={22}
            color="#67e8f9"
            style={{ marginBottom: 4 }}
          />
          <Text className="mt-1 text-[10px] font-bold text-[#67e8f9]">Tide</Text>
          <Text className="mt-0.5 text-[12px] font-bold text-[#f8fafc]">
            {nextTide.type === "high" ? "High" : "Low"} →{" "}
            {nextTide.height.toFixed(1)}m
          </Text>
          <Text className="mt-0.5 text-[10px] text-[#94a3b8]">Next: {nextTide.time}</Text>
        </View>

        {/* Best Fishing Times */}
        <View className="w-[48%] rounded-[16px] border border-[#34d39930] bg-[#334155] p-2">
          <Ionicons
            name="time-outline"
            size={22}
            color="#6ee7b7"
            style={{ marginBottom: 4 }}
          />
          <Text className="mt-1 text-[10px] font-bold text-[#6ee7b7]">
            Best Time
          </Text>
          <Text className="mt-0.5 text-[12px] font-bold text-[#f8fafc]">
            {bestTime.start} – {bestTime.end}
          </Text>
          <Text className="mt-0.5 text-[10px] text-[#94a3b8]">
            {bestTime.quality.charAt(0).toUpperCase() +
              bestTime.quality.slice(1)}{" "}
            activity
          </Text>
        </View>
      </View>

      {/* Tide Timeline */}
      <View className="my-4">
        <Text className="mb-2 text-[12px] font-bold text-[#f8fafc]">Tide Schedule</Text>
        <View className="rounded-[16px] border border-[#334155] bg-[#334155] p-4">
          {data.tides.map((tide, index) => (
            <View key={index} className="mb-2 flex-row items-start">
              <View className="mr-2 h-[22px] w-[22px] items-center justify-center rounded-full bg-[#1e293b]">
                <Ionicons
                  name={tide.type === "high" ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={tide.type === "high" ? "#67e8f9" : "#a5b4fc"}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[12px] font-bold text-[#f8fafc]">{tide.time}</Text>
                <Text className="mt-0.5 text-[10px] text-[#e2e8f0]">
                  {tide.type === "high" ? "High" : "Low"} Tide
                </Text>
                <Text className="mt-0.5 text-[10px] text-[#94a3b8]">
                  {tide.height.toFixed(1)}m
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Best Fishing Times Timeline */}
      <View className="my-4">
        <Text className="mb-2 text-[12px] font-bold text-[#f8fafc]">Best Fishing Times</Text>
        <View className="rounded-[16px] border border-[#334155] bg-[#334155] p-4">
          {data.bestFishingTimes.map((time, index) => (
            <View key={index} className="mb-2 flex-row items-start">
              <View
                className="mr-2 h-[22px] w-[22px] items-center justify-center rounded-full"
                style={{ backgroundColor: getQualityColor(time.quality) + "30" }}
              >
                <Ionicons
                  name="fish-outline"
                  size={12}
                  color={getQualityColor(time.quality)}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[12px] font-bold text-[#f8fafc]">
                  {time.start} – {time.end}
                </Text>
                <Text
                  className="mt-0.5 text-[10px]"
                  style={{ color: getQualityColor(time.quality) }}
                >
                  {time.quality.charAt(0).toUpperCase() + time.quality.slice(1)}{" "}
                  Fishing
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity className="my-4 flex-row items-center justify-center gap-1.5 py-2" onPress={handleRefresh}>
        <Ionicons
          name="refresh-outline"
          size={16}
          color={COLORS.primaryLight}
        />
        <Text className="text-[12px] font-bold text-[#3b82f6]">Refresh Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
