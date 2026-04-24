import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface ProfileMenuProps {
  size?: number;
}

export function ProfileMenu({ size = 36 }: ProfileMenuProps) {
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
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        onPress={openMenu}
        activeOpacity={0.7}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.44 }]}>
          {(user?.name ?? "F")[0].toUpperCase()}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menu,
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
              },
            ]}
          >
            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>
                  {(user?.name ?? "F")[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name ?? "Fisherman"}
                </Text>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user?.email ?? ""}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Menu Items */}
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && styles.menuItemLast,
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.danger ? COLORS.error : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    item.danger && styles.menuItemTextDanger,
                  ]}
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

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: SPACING.lg,
  },
  menu: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    minWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  menuAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  menuAvatarText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  menuItemLast: {
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  menuItemText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textSecondary,
  },
  menuItemTextDanger: {
    color: COLORS.error,
  },
});
