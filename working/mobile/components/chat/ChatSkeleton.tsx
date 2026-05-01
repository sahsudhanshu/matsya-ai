import React, { useEffect, useRef } from "react";
import { View, Animated, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function ChatSkeleton() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  return (
    <View className="py-lg gap-xl pt-2xl">
      {/* Bot message skeleton */}
      <Animated.View
        style={[{ opacity: pulseAnim }]}
        className="px-[16px] py-[6px] flex-row items-start gap-[10px]"
      >
        <View className="w-[30px] h-[30px] rounded-full bg-[rgba(16,185,129,0.15)] items-center justify-center border border-[rgba(16,185,129,0.3)] mt-[2px]">
          <Ionicons
            name="hardware-chip-outline"
            size={15}
            color={COLORS.primaryLight}
          />
        </View>
        <View
          style={[{ width: "70%", height: 60 }]}
          className="rounded-[18px] bg-bgCard rounded-bl-[4px]"
        />
      </Animated.View>

      {/* User message skeleton */}
      <Animated.View
        style={[{ opacity: pulseAnim }]}
        className="px-[16px] py-[6px] flex-row items-start justify-end"
      >
        <View
          style={[{ width: "45%", height: 40 }]}
          className="rounded-[18px] bg-[#1e40af80] rounded-br-[4px]"
        />
      </Animated.View>

      {/* Bot message skeleton */}
      <Animated.View
        style={[{ opacity: pulseAnim }]}
        className="px-[16px] py-[6px] flex-row items-start gap-[10px]"
      >
        <View className="w-[30px] h-[30px] rounded-full bg-[rgba(16,185,129,0.15)] items-center justify-center border border-[rgba(16,185,129,0.3)] mt-[2px]">
          <Ionicons
            name="hardware-chip-outline"
            size={15}
            color={COLORS.primaryLight}
          />
        </View>
        <View
          style={[{ width: "85%", height: 100 }]}
          className="rounded-[18px] bg-bgCard rounded-bl-[4px]"
        />
      </Animated.View>
    </View>
  );
}
