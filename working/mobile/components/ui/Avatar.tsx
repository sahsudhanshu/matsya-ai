import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../../lib/constants";

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onPress?: () => void;
  showBadge?: boolean;
  badgeType?: "verified" | "premium";
  loading?: boolean;
  className?: string;
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
  className = "",
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
    <View className={`relative ${className}`} style={[{ width: avatarSize, height: avatarSize }]}>
      {loading ? (
        <View
          className="rounded-full bg-slate-700 border-2 border-slate-700 overflow-hidden justify-center items-center"
          style={[{ width: avatarSize, height: avatarSize }]}
        >
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : uri ? (
        <Image
          source={{ uri }}
          className="rounded-full bg-slate-700 border-2 border-slate-700 overflow-hidden justify-center items-center"
          style={[{ width: avatarSize, height: avatarSize }]}
          resizeMode="cover"
        />
      ) : (
        <View
          className="rounded-full bg-blue-800 border-2 border-slate-700 overflow-hidden justify-center items-center"
          style={[{ width: avatarSize, height: avatarSize }]}
        >
          <Text className="text-white font-bold" style={[{ fontSize }]}>{initials}</Text>
        </View>
      )}

      {editable && (
        <View className={`absolute bottom-0 right-0 rounded-full bg-blue-800 justify-center items-center border-2 border-slate-900 ${size === "sm" ? 'w-4 h-4' : 'w-[22px] h-[22px]'}`}>
          <Ionicons
            name="camera"
            size={size === "sm" ? 12 : 16}
            color={COLORS.white}
          />
        </View>
      )}

      {showBadge && badgeType && (
        <View className={`absolute -top-0.5 -right-0.5 rounded-full bg-emerald-500 justify-center items-center border-2 border-slate-900 ${size === "sm" ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'}`}>
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
