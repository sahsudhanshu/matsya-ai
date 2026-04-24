import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onPress?: () => void;
  showBadge?: boolean;
  badgeType?: "verified" | "premium";
  loading?: boolean;
}

const SIZES = {
  sm: 28,
  md: 40,
  lg: 54,
  xl: 80,
};

const FONT_SIZES = {
  sm: FONTS.sizes.xs,
  md: FONTS.sizes.base,
  lg: FONTS.sizes.lg,
  xl: FONTS.sizes["2xl"],
};

export function Avatar({
  uri,
  name,
  size = "md",
  editable = false,
  onPress,
  showBadge,
  badgeType,
  loading = false,
}: AvatarProps) {
  const avatarSize = SIZES[size];
  const fontSize = FONT_SIZES[size];

  // Get initials from name
  const getInitials = (fullName?: string): string => {
    if (!fullName || fullName.trim().length === 0) {
      return "U"; // Default to 'U' for User
    }
    const trimmedName = fullName.trim();
    const parts = trimmedName.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return trimmedName.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  const content = (
    <View style={[styles.container, { width: avatarSize, height: avatarSize }]}>
      {loading ? (
        <View
          style={[styles.avatar, { width: avatarSize, height: avatarSize }]}
        >
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : uri ? (
        <Image
          source={{ uri }}
          style={[styles.avatar, { width: avatarSize, height: avatarSize }]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.initialsContainer,
            { width: avatarSize, height: avatarSize },
          ]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </View>
      )}

      {editable && (
        <View style={[styles.editIcon, size === "sm" && styles.editIconSm]}>
          <Ionicons
            name="camera"
            size={size === "sm" ? 12 : 16}
            color={COLORS.white}
          />
        </View>
      )}

      {showBadge && badgeType && (
        <View style={[styles.badge, size === "sm" && styles.badgeSm]}>
          <Ionicons
            name={badgeType === "verified" ? "checkmark-circle" : "star"}
            size={size === "sm" ? 12 : 16}
            color={COLORS.white}
          />
        </View>
      )}
    </View>
  );

  if (onPress || editable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={loading}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  avatar: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  initialsContainer: {
    backgroundColor: COLORS.primary,
  },
  initials: {
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  editIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.bgDark,
  },
  editIconSm: {
    width: 16,
    height: 16,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.bgDark,
  },
  badgeSm: {
    width: 14,
    height: 14,
  },
});
