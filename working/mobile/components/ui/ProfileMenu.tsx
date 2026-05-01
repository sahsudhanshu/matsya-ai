import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { COLORS } from "../../lib/constants";

interface ProfileMenuProps {
  size?: number;
  className?: string;
}

export function ProfileMenu({ size = 36, className = "" }: ProfileMenuProps) {
  const { user, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setMenuVisible(false));
  };

  const handleSettings = () => {
    closeMenu();
    setTimeout(() => {
      router.push("/(tabs)/settings");
    }, 200);
  };

  const handleLogout = () => {
    closeMenu();
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.replace("/auth/login");
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const menuItems = [
    {
      icon: "settings-outline" as const,
      label: "Settings",
      onPress: handleSettings,
    },
    {
      icon: "log-out-outline" as const,
      label: "Logout",
      onPress: handleLogout,
      danger: true,
    },
  ];

  return (
    <>
      <TouchableOpacity
        className={`bg-blue-800 items-center justify-center ${className}`}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        onPress={openMenu}
        activeOpacity={0.7}
      >
        <Text className="text-white font-bold" style={[{ fontSize: size * 0.44 }]}>
          {(user?.name ?? "F")[0].toUpperCase()}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <Pressable className="flex-1 bg-black/50 justify-start items-end pt-[60px] pr-6" onPress={closeMenu}>
          <Animated.View
            className="bg-slate-800 rounded-2xl min-w-[220px] border border-slate-700"
            style={[
              {
                transform: [
                  { scale: scaleAnim },
                  {
                    translateY: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
                opacity: scaleAnim,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              },
            ]}
          >
            {/* User Info */}
            <View className="flex-row items-center p-4 gap-2">
              <View className="w-11 h-11 rounded-full bg-blue-800 items-center justify-center">
                <Text className="text-[18px] text-white font-bold">
                  {(user?.name ?? "F")[0].toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-slate-50 mb-0.5" numberOfLines={1}>
                  {user?.name ?? "Fisherman"}
                </Text>
                <Text className="text-[10px] text-slate-400" numberOfLines={1}>
                  {user?.email ?? ""}
                </Text>
              </View>
            </View>

            <View className="h-[1px] bg-slate-700 mx-2" />

            {/* Menu Items */}
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                className={`flex-row items-center p-4 gap-2 ${index === menuItems.length - 1 ? 'rounded-b-2xl' : ''}`}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.danger ? COLORS.error : COLORS.textSecondary}
                />
                <Text
                  className={`text-[12px] font-medium ${item.danger ? 'text-red-500' : 'text-slate-200'}`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}
