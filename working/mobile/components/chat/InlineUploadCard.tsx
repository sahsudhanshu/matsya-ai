/**
 * InlineUploadCard - A camera/upload CTA card rendered inside a chat bubble
 * when the agent returns ui.upload = true.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS } from "../../lib/constants";

interface Props {
  onUploadComplete?: () => void;
}

export function InlineUploadCard({ onUploadComplete }: Props) {
  return (
    <View className="rounded-md overflow-hidden bg-bgCard border border-[#1e40af40] mt-2 mb-1 p-[14px]">
      <View className="flex-row items-center gap-[12px] mb-3">
        <View className="w-[44px] h-[44px] rounded-md bg-primary items-center justify-center">
          <Ionicons name="camera" size={22} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-textPrimary mb-[2px]">Scan Your Catch</Text>
          <Text className="text-[12px] text-textMuted leading-[16px]">
            Take a photo or pick from gallery for instant AI analysis
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-[6px] mb-3">
        {[
          { icon: "fish" as const, text: "Species ID" },
          { icon: "medkit" as const, text: "Disease Check" },
          { icon: "scale" as const, text: "Weight Est." },
          { icon: "cash" as const, text: "Market Value" },
        ].map((f) => (
          <View key={f.text} className="flex-row items-center gap-1 bg-[#1e40af15] rounded-full px-[10px] py-1">
            <Ionicons name={f.icon} size={11} color={COLORS.primaryLight} />
            <Text className="text-[11px] text-primaryLight font-medium">{f.text}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        className="flex-row items-center justify-center gap-2 bg-primary rounded-md py-3"
        onPress={() => router.push("/(tabs)/upload")}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={18} color="#fff" />
        <Text className="text-[14px] font-semibold text-white">Open Camera</Text>
      </TouchableOpacity>
    </View>
  );
}
