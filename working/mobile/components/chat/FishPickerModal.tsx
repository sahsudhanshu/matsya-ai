/**
 * FishPickerModal - Select which fish from a scan to measure for weight estimation.
 * Shows a list of detected fish with species, confidence, and measurement status.
 */
import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "../ui/Modal";
import { COLORS } from "../../lib/constants";

export interface FishItem {
  index: number;
  species: string;
  confidence: number;
  diseaseStatus: string;
  cropUrl?: string;
  /** Already measured weight in grams, or null if not yet measured */
  measuredWeightG: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectFish: (fishIndex: number, species: string) => void;
  fish: FishItem[];
}

export function FishPickerModal({
  visible,
  onClose,
  onSelectFish,
  fish,
}: Props) {
  const measuredCount = fish.filter((f) => f.measuredWeightG !== null).length;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Select Fish to Weigh"
      size="md"
    >
      <View className="px-md pb-sm">
        <Text className="text-[12px] text-textMuted">
          {measuredCount} of {fish.length} fish measured
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-md gap-sm pb-md"
        showsVerticalScrollIndicator={false}
      >
        {fish.map((item) => {
          const isMeasured = item.measuredWeightG !== null;
          return (
            <TouchableOpacity
              key={item.index}
              className={`flex-row items-center bg-bgCard rounded-lg p-sm border ${
                isMeasured
                  ? "border-[#10b98140] bg-[#10b98108]"
                  : "border-borderDark"
              }`}
              onPress={() => onSelectFish(item.index, item.species)}
              activeOpacity={0.7}
            >
              {item.cropUrl ? (
                <Image
                  source={{ uri: item.cropUrl }}
                  className="w-[48px] h-[48px] rounded-md overflow-hidden"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-[48px] h-[48px] rounded-md overflow-hidden bg-bgDark items-center justify-center">
                  <Ionicons name="fish" size={20} color={COLORS.primaryLight} />
                </View>
              )}
              <View className="flex-1 ml-sm">
                <Text className="text-[10px] text-textMuted font-semibold uppercase tracking-[0.5px]">Fish #{item.index + 1}</Text>
                <Text className="text-[13px] text-textPrimary font-semibold">{item.species}</Text>
                <Text className="text-[10px] text-textSubtle">
                  {(item.confidence * 100).toFixed(0)}% conf ·{" "}
                  {item.diseaseStatus}
                </Text>
              </View>
              <View className="ml-sm">
                {isMeasured ? (
                  <View className="flex-row items-center gap-1 bg-[#10b98118] px-sm py-xs rounded-full">
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={COLORS.success}
                    />
                    <Text className="text-[10px] text-success font-semibold">
                      {(item.measuredWeightG! / 1000).toFixed(2)} kg
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1 bg-[#3b82f618] px-sm py-xs rounded-full">
                    <Ionicons
                      name="scale-outline"
                      size={16}
                      color={COLORS.primaryLight}
                    />
                    <Text className="text-[10px] text-primaryLight font-semibold">Measure</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {measuredCount > 0 && (
        <View className="flex-row justify-between items-center px-md py-md border-t border-borderDark">
          <Text className="text-[12px] text-textMuted font-medium">Total Measured Weight</Text>
          <Text className="text-[15px] text-primaryLight font-bold">
            {(
              fish
                .filter((f) => f.measuredWeightG !== null)
                .reduce((sum, f) => sum + f.measuredWeightG!, 0) / 1000
            ).toFixed(2)}{" "}
            kg
          </Text>
        </View>
      )}
    </Modal>
  );
}
