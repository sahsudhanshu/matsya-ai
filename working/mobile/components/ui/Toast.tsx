import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide: () => void;
  className?: string;
}

export function Toast({
  visible,
  message,
  type = "info",
  duration = 3000,
  onHide,
  className = "",
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const getToastStyle = () => {
    switch (type) {
      case "success":
        return {
          backgroundColor: COLORS.success,
          icon: "checkmark-circle" as const,
        };
      case "error":
        return { backgroundColor: COLORS.error, icon: "close-circle" as const };
      case "warning":
        return { backgroundColor: COLORS.warning, icon: "warning" as const };
      case "info":
      default:
        return {
          backgroundColor: COLORS.primary,
          icon: "information-circle" as const,
        };
    }
  };

  const toastStyle = getToastStyle();

  return (
    <Animated.View
      className={`absolute top-[50px] left-4 right-4 rounded-xl py-2 px-4 z-[9999] ${className}`}
      style={[
        {
          backgroundColor: toastStyle.backgroundColor,
          transform: [{ translateY }],
          opacity,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
      ]}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name={toastStyle.icon} size={18} color="#ffffff" />
        <Text className="flex-1 text-[12px] font-semibold text-white" numberOfLines={2}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={hideToast}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
