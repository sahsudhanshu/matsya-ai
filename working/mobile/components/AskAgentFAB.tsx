/**
 * AskAgentFAB - Floating "Ask Matsya AI" button that appears on every screen
 * except the chat screen. Collects context from AgentContext and navigates to chat.
 */
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
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
        styles.container,
        { bottom: bottomOffset, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        style={styles.fab}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={styles.fabContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="chatbubble" size={16} color="#fff" />
          </View>
          <Text style={styles.fabText}>Ask Matsya AI</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    zIndex: 999,
    ...Platform.select({
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
  },
  fab: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS["2xl"],
    borderWidth: 1,
    borderColor: COLORS.primaryLight + "40",
  },
  fabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
