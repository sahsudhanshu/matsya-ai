/**
 * AskAgentFAB - Floating "Ask Matsya AI" button that appears on every screen
 * except the chat screen. Collects context from AgentContext and navigates to chat.
 */
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS, RADIUS } from "../lib/constants";
import { useAgentContext } from "../lib/agent-context";

interface Props {
  /** Override the default prompt */
  customPrompt?: string;
  /** Position offset from bottom */
  bottomOffset?: number;
}

export function AskAgentFAB({ customPrompt, bottomOffset = 80 }: Props) {
  const { getContextPrompt, state } = useAgentContext();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
      delay: 300,
    }).start();
  }, []);

  const handlePress = () => {
    const contextPrompt = getContextPrompt();
    const message = customPrompt || contextPrompt;

    router.push({
      pathname: "/(tabs)/chat",
      params: message ? { agentContext: message } : undefined,
    });
  };

  // Don't show on chat screen
  if (state.currentScreen === "chat") return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          right: 16,
          zIndex: 999,
          bottom: bottomOffset,
          transform: [{ scale: scaleAnim }],
        },
        Platform.select({
          ios: {
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
          },
          android: {
            elevation: 8,
          },
        }),
      ]}
    >
      <TouchableOpacity
        className="rounded-[24px] border border-[#3b82f640] bg-[#1e40af]"
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View className="flex-row items-center gap-2 px-4 py-3">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)]">
            <Ionicons name="chatbubble" size={16} color="#fff" />
          </View>
          <Text className="text-[13px] font-bold tracking-[0.3px] text-white">
            Ask Matsya AI
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
