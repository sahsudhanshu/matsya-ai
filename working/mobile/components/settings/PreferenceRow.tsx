import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  TextInput,
} from "react-native";
import { COLORS } from "../../lib/constants";

interface PreferenceRowProps {
  label: string;
  description?: string;
  type: "toggle" | "select" | "text" | "action";
  value?: any;
  onValueChange?: (value: any) => void;
  onPress?: () => void;
  options?: Array<{ label: string; value: any }>;
  danger?: boolean;
}

export function PreferenceRow({
  label,
  description,
  type,
  value,
  onValueChange,
  onPress,
  danger,
}: PreferenceRowProps) {
  const renderControl = () => {
    switch (type) {
      case "toggle":
        return (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
            thumbColor={value ? COLORS.primary : COLORS.textSubtle}
          />
        );

      case "select":
        return (
          <View className="flex-row items-center gap-sm">
            <Text className="text-sm text-textMuted">{value || "Select"}</Text>
            <Text className="text-lg text-textSubtle">›</Text>
          </View>
        );

      case "text":
        return (
          <TextInput
            className="text-sm text-textPrimary bg-bgDark rounded-md px-sm py-xs min-w-[120px] text-right"
            value={value}
            onChangeText={onValueChange}
            placeholder="Enter value"
            placeholderTextColor={COLORS.textSubtle}
          />
        );

      case "action":
        return (
          <View className="flex-row items-center gap-sm">
            {value && <Text className="text-sm text-textMuted">{value}</Text>}
            <Text className={`text-lg ${danger ? "text-error" : "text-textSubtle"}`}>
              {danger ? "→" : "›"}
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  const content = (
    <View className="flex-row justify-between items-center px-md py-sm border-b border-border">
      <View className="flex-1 mr-sm">
        <Text className={`text-sm font-medium ${danger ? "text-error" : "text-textSecondary"}`}>
          {label}
        </Text>
        {description && <Text className="text-xs text-textSubtle mt-[2px]">{description}</Text>}
      </View>
      <View className="flex-row items-center">{renderControl()}</View>
    </View>
  );

  if (type === "action" || type === "select") {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
