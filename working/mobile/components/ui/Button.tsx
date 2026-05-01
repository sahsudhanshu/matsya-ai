import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { COLORS } from "../../lib/constants";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  className?: string;
  labelClassName?: string;
}

const SIZE_CLASSES = {
  sm: "px-3 py-1.5 min-h-[30px]",
  md: "px-4 py-2.5 min-h-[40px]",
  lg: "px-5 py-3 min-h-[46px]",
};

const VARIANT_CLASSES = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  outline: "bg-transparent border-[1.5px] border-primary",
  ghost: "bg-primary/10",
  danger: "bg-error",
};

const LABEL_SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg", // Approximate of md size in constants if needed
};

const LABEL_VARIANT_CLASSES = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary",
  ghost: "text-primary",
  danger: "text-white",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  fullWidth = false,
  className = "",
  labelClassName = "",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerClasses = [
    "rounded-xl items-center justify-center flex-row",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    fullWidth ? "w-full" : "",
    isDisabled ? "opacity-50" : "",
    className
  ].filter(Boolean).join(" ");

  const labelClasses = [
    "font-semibold tracking-wide",
    LABEL_SIZE_CLASSES[size],
    LABEL_VARIANT_CLASSES[variant],
    labelClassName
  ].filter(Boolean).join(" ");

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={style}
      className={containerClasses}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "outline" || variant === "ghost"
              ? COLORS.primary
              : "#fff"
          }
        />
      ) : (
        <View className="flex-row items-center">
          {icon && iconPosition === "left" && (
            <View className="mr-3">{icon}</View>
          )}
          <Text style={textStyle} className={labelClasses}>{label}</Text>
          {icon && iconPosition === "right" && (
            <View className="ml-3">{icon}</View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
