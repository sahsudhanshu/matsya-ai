/**
 * ToolsOrbit - Vertical slide-up navigation menu FAB.
 * Opens as a vertical list anchored to the left of the screen.
 */
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS, RADIUS, FONTS } from "../lib/constants";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface ToolItem {
  icon: IoniconName;
  label: string;
  route: string;
  color: string;
}

const TOOLS: ToolItem[] = [
  {
    icon: "camera",
    label: "Scan",
    route: "/(tabs)/upload",
    color: COLORS.primary,
  },
  { icon: "map", label: "Map", route: "/(tabs)/map", color: COLORS.secondary },
  {
    icon: "time",
    label: "History",
    route: "/(tabs)/history",
    color: "#7c3aed",
  },
  {
    icon: "bar-chart",
    label: "Analytics",
    route: "/(tabs)/analytics",
    color: COLORS.accent,
  },
  {
    icon: "settings",
    label: "Settings",
    route: "/(tabs)/settings",
    color: COLORS.textMuted,
  },
];

const SCREEN_WIDTH = Dimensions.get("window").width;

interface Props {
  onChatPress: () => void;
  isChatActive: boolean;
}

export function ToolsOrbit({ onChatPress, isChatActive }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const listAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const open = () => {
    setIsOpen(true);
    Animated.parallel([
      Animated.spring(listAnim, {
        toValue: 1,
        bounciness: 4,
        speed: 10,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const close = () => {
    Animated.parallel([
      Animated.spring(listAnim, {
        toValue: 0,
        bounciness: 4,
        speed: 12,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setIsOpen(false));
  };

  const toggle = () => (isOpen ? close() : open());

  const handleToolPress = (route: string) => {
    close();
    setTimeout(() => router.push(route as any), 180);
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <>
      {/* Vertical list overlay */}
      {isOpen && (
        <Modal visible transparent animationType="none" statusBarTranslucent>
          <Pressable style={styles.overlay} onPress={close}>
            {/* Vertical list anchored above Tools button */}
            <Animated.View
              style={[
                styles.listContainer,
                {
                  opacity: listAnim,
                  transform: [
                    {
                      scale: listAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                    {
                      translateY: listAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [15, 0],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="box-none"
            >
              {TOOLS.map((tool, i) => {
                const itemTranslateY = listAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10 * (TOOLS.length - i), 0],
                  extrapolate: "clamp",
                });
                const itemOpacity = listAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.8, 1],
                  extrapolate: "clamp",
                });
                return (
                  <Animated.View
                    key={tool.label}
                    style={{
                      transform: [{ translateY: itemTranslateY }],
                      opacity: itemOpacity,
                      width: "100%",
                    }}
                  >
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => handleToolPress(tool.route)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.listIcon,
                          { backgroundColor: tool.color + "22" },
                        ]}
                      >
                        <Ionicons
                          name={tool.icon}
                          size={20}
                          color={tool.color}
                        />
                      </View>
                      <Text style={styles.listLabel}>{tool.label}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* Main FAB bar */}
      <View style={styles.fabBar}>
        {/* Chat button */}
        <TouchableOpacity
          style={styles.toolsBtn}
          onPress={onChatPress}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubble-outline"
            size={22}
            color={isChatActive ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.toolsBtnText,
              isChatActive && { color: COLORS.primary },
            ]}
          >
            Chat
          </Text>
        </TouchableOpacity>

        {/* Home FAB - center */}
        <Animated.View style={styles.agentFabOuter}>
          <TouchableOpacity
            style={styles.agentFab}
            onPress={() => router.push("/")}
            activeOpacity={0.85}
          >
            <Ionicons name="home" size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Tools button */}
        <TouchableOpacity
          style={styles.toolsBtn}
          onPress={toggle}
          activeOpacity={0.8}
        >
          <Animated.View
            style={[styles.toolsIconWrapper, { transform: [{ rotate: spin }] }]}
          >
            <Ionicons name="apps" size={20} color={COLORS.textPrimary} />
          </Animated.View>
          <Text style={styles.toolsBtnText}>Tools</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    paddingRight: 16,
    paddingBottom: 96, // above the fab bar
  },
  listContainer: {
    gap: 2,
    alignItems: "flex-end",
    backgroundColor: COLORS.bgCard,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  listItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 140,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  listLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },

  // FAB bar
  fabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 24,
    paddingTop: 6,
    paddingHorizontal: 24,
  },
  toolsBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 16,
    minWidth: 60,
  },
  toolsIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.border + "40", // light subtle background
    alignItems: "center",
    justifyContent: "center",
  },
  toolsBtnText: {
    fontSize: 10,
    color: COLORS.textSubtle,
    fontWeight: "500",
  },
  agentFabOuter: {
    marginTop: -28,
    alignItems: "center",
    justifyContent: "center",
  },
  agentFab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primaryLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
});
