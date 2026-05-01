import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../lib/constants";

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
    <View style={styles.container}>
      {/* Bot message skeleton */}
      <Animated.View
        style={[
          styles.messageRow,
          styles.messageRowBot,
          { opacity: pulseAnim },
        ]}
      >
        <View style={styles.botAvatar}>
          <Ionicons
            name="hardware-chip-outline"
            size={15}
            color={COLORS.primaryLight}
          />
        </View>
        <View
          style={[
            styles.skeletonContent,
            styles.skeletonBot,
            { width: "70%", height: 60 },
          ]}
        />
      </Animated.View>

      {/* User message skeleton */}
      <Animated.View
        style={[
          styles.messageRow,
          styles.messageRowUser,
          { opacity: pulseAnim },
        ]}
      >
        <View
          style={[
            styles.skeletonContent,
            styles.skeletonUser,
            { width: "45%", height: 40 },
          ]}
        />
      </Animated.View>

      {/* Bot message skeleton */}
      <Animated.View
        style={[
          styles.messageRow,
          styles.messageRowBot,
          { opacity: pulseAnim },
        ]}
      >
        <View style={styles.botAvatar}>
          <Ionicons
            name="hardware-chip-outline"
            size={15}
            color={COLORS.primaryLight}
          />
        </View>
        <View
          style={[
            styles.skeletonContent,
            styles.skeletonBot,
            { width: "85%", height: 100 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.lg,
    gap: SPACING.xl,
    paddingTop: SPACING["2xl"],
  },
  messageRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  messageRowBot: {
    gap: 10,
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(16,185,129,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    marginTop: 2,
  },
  skeletonContent: {
    borderRadius: 18,
  },
  skeletonBot: {
    backgroundColor: COLORS.bgCard,
    borderBottomLeftRadius: 4,
  },
  skeletonUser: {
    backgroundColor: COLORS.primary + "80", // slightly transparent primary
    borderBottomRightRadius: 4,
  },
});
