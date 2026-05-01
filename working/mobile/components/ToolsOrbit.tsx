/**
 * ToolsOrbit - Vertical slide-up navigation menu FAB.
 * Opens as a vertical list anchored to the left of the screen.
 */
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  
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
          <Pressable className="flex-1 bg-transparent justify-end items-end pr-4 pb-[96px]" onPress={close}>
            {/* Vertical list anchored above Tools button */}
              <Animated.View
                className="items-end bg-bgCard py-3 px-2 rounded-[24px] border border-borderDark shadow-xl shadow-black/15 gap-0.5"
                style={{
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
                }}
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
                      className="flex-row-reverse items-center gap-[14px] py-2.5 px-3 min-w-[140px]"
                      onPress={() => handleToolPress(tool.route)}
                      activeOpacity={0.8}
                    >
                      <View
                        className="w-9 h-9 rounded-full items-center justify-center"
                        style={{ backgroundColor: tool.color + "22" }}
                      >
                        <Ionicons
                          name={tool.icon}
                          size={20}
                          color={tool.color}
                        />
                      </View>
                      <Text className="text-[14px] font-semibold text-textPrimary">{tool.label}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* Main FAB bar */}
      <View className="flex-row items-center justify-around bg-bgCard border-t border-borderDark pb-6 pt-1.5 px-6">
        {/* Chat button */}
        <TouchableOpacity
          className="items-center justify-center gap-1 py-1 px-4 min-w-[60px]"
          onPress={onChatPress}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubble-outline"
            size={22}
            color={isChatActive ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            className={`text-[10px] font-medium ${isChatActive ? 'text-primary' : 'text-textSubtle'}`}
          >
            Chat
          </Text>
        </TouchableOpacity>

        {/* Home FAB - center */}
        <Animated.View className="-mt-7 items-center justify-center">
          <TouchableOpacity
            className="w-[62px] h-[62px] rounded-full bg-primary border-[3px] border-bgDark items-center justify-center shadow-lg shadow-primaryLight/40"
            onPress={() => router.push("/")}
            activeOpacity={0.85}
          >
            <Ionicons name="home" size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Tools button */}
        <TouchableOpacity
          className="items-center justify-center gap-1 py-1 px-4 min-w-[60px]"
          onPress={toggle}
          activeOpacity={0.8}
        >
          <Animated.View
            className="w-9 h-9 rounded-full items-center justify-center bg-[#33415540]"
            style={{ transform: [{ rotate: spin }] }}
          >
            <Ionicons name="apps" size={20} color={COLORS.textPrimary} />
          </Animated.View>
          <Text className="text-[10px] text-textSubtle font-medium">Tools</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
