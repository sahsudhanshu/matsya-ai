import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  className?: string;
}

export function Input({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  showPasswordToggle,
  secureTextEntry,
  className = "",
  ...rest
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = showPasswordToggle || secureTextEntry;

  return (
    <View style={containerStyle} className={`gap-2 ${className}`}>
      {label && <Text className="text-[12px] font-medium text-slate-200 tracking-[0.2px]">{label}</Text>}
      <View className={`flex-row items-center bg-slate-700 rounded-xl border min-h-[44px] ${error ? 'border-red-500' : 'border-slate-700'}`}>
        {leftIcon && <View className="pl-4">{leftIcon}</View>}
        <TextInput
          placeholderTextColor={COLORS.textSubtle}
          className={`flex-1 px-4 py-[10px] text-slate-50 text-[13px] ${leftIcon ? 'pl-2' : ''}`}
          style={style}
          secureTextEntry={isPassword && !isPasswordVisible}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            className="pr-4"
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
        {!isPassword && rightIcon && (
          <View className="pr-4">{rightIcon}</View>
        )}
      </View>
      {error && <Text className="text-[12px] text-red-500">{error}</Text>}
    </View>
  );
}
