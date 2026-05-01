import React from "react";
import { Tabs, usePathname } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, SPACING } from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { View,  Platform } from "react-native";
import { ConnectionQualityIcon } from "../../components/ui/ConnectionQualityIcon";
import { ToolsOrbit } from "../../components/ToolsOrbit";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const pathname = usePathname();

  const isChatActive = pathname === "/chat" || pathname === "/(tabs)/chat";

  // Header right component with connection quality
  const HeaderRight = () => (
    <View className="flex-row items-center gap-2 mr-4">
      <ConnectionQualityIcon size={18} />
    </View>
  );

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarHideOnKeyboard: true,
          headerShown: true,
          headerStyle: {
            backgroundColor: COLORS.bgCard,
            borderBottomColor: COLORS.border,
            borderBottomWidth: 1,
          },
          headerTitleStyle: {
            color: COLORS.textPrimary,
            fontSize: FONTS.sizes.md,
            fontWeight: FONTS.weights.semibold,
          },
          headerRight: () => <HeaderRight />,
          tabBarStyle: { display: "none" },
        }}
        tabBar={() => (
          <ToolsOrbit
            onChatPress={() => {
              const router = require("expo-router").router;
              router.navigate("/(tabs)/chat");
            }}
            isChatActive={isChatActive}
          />
        )}
      >
        <Tabs.Screen
          name="chat"
          options={{ title: t("nav.assistant"), headerShown: false }}
        />
        <Tabs.Screen name="index" options={{ title: t("nav.dashboard") }} />
        <Tabs.Screen name="upload" options={{ title: t("nav.upload") }} />
        <Tabs.Screen name="map" options={{ title: t("nav.oceanMap") }} />
        <Tabs.Screen name="history" options={{ title: "History" }} />
        <Tabs.Screen name="settings" options={{ title: t("nav.settings") }} />
        <Tabs.Screen name="analytics" options={{ href: null }} />
      </Tabs>
    </>
  );
}
