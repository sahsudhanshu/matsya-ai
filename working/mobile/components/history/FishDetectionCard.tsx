import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "../../lib/constants";
import { Card } from "../ui/Card";

export interface FishDetection {
  cropUrl: string;
  species: string;
  confidence: number;
  diseaseStatus: string;
  diseaseConfidence: number;
  weight: number;
  value: number;
  gradcamUrls?: {
    species: string;
    disease: string;
  };
}

interface FishDetectionCardProps {
  detection: FishDetection;
  onExpand: () => void;
  expanded: boolean;
}

export function FishDetectionCard({
  detection,
  onExpand,
  expanded,
}: FishDetectionCardProps) {
  const isDiseased = !detection.diseaseStatus.toLowerCase().includes("healthy");

  return (
    <Card variant="default" padding={0} className="mb-md overflow-hidden">
      <View className="flex-row p-sm gap-sm">
        {/* Fish Crop Image */}
        <Image
          source={{ uri: detection.cropUrl }}
          className="w-[68px] h-[68px] rounded-md bg-bgSurface"
          resizeMode="cover"
        />

        {/* Info */}
        <View className="flex-1">
          <Text className="text-sm font-bold text-textPrimary mb-0.5">{detection.species}</Text>
          <Text className="text-xs text-textMuted mb-xs">
            {(detection.confidence * 100).toFixed(1)}% confident
          </Text>

          <View className="flex-row items-center mb-xs">
            <View
              className={`rounded-full px-2 py-0.5 ${
                isDiseased ? "bg-error/20" : "bg-success/20"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  isDiseased ? "text-error" : "text-success"
                }`}
              >
                {detection.diseaseStatus}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-md">
            <View className="flex-row items-center gap-1">
              <Ionicons
                name="scale-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text className="text-xs text-textSecondary font-semibold">
                {detection.weight.toFixed(2)} kg
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons
                name="cash-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text className="text-xs text-textSecondary font-semibold">₹{detection.value.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {/* Expand Button */}
        {detection.gradcamUrls && (
          <TouchableOpacity className="justify-center items-center w-8" onPress={onExpand}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={COLORS.primaryLight}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded Grad-CAM View */}
      {expanded && detection.gradcamUrls && (
        <View className="border-t border-borderLight p-sm bg-bgSurface">
          <Text className="text-xs font-bold text-textPrimary mb-xs">Grad-CAM Visualizations</Text>

          <View className="flex-row gap-sm">
            <View className="flex-1">
              <Text className="text-xs text-textMuted mb-xs">Species Detection</Text>
              <Image
                source={{ uri: detection.gradcamUrls.species }}
                className="w-full aspect-square rounded-md bg-bgCard"
                resizeMode="cover"
              />
            </View>

            <View className="flex-1">
              <Text className="text-xs text-textMuted mb-xs">Disease Detection</Text>
              <Image
                source={{ uri: detection.gradcamUrls.disease }}
                className="w-full aspect-square rounded-md bg-bgCard"
                resizeMode="cover"
              />
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}
