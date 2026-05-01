import React from "react";
import { View, Text } from "react-native";
import { Card } from "../ui/Card";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="mb-md">
      <Text className="text-xs text-textSubtle font-medium tracking-[0.8px] uppercase mb-xs px-xs">
        {title}
      </Text>
      <Card padding={0} className="overflow-hidden">
        {children}
      </Card>
    </View>
  );
}
