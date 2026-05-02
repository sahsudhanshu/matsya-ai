import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Href } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { getAnalytics } from "../../lib/api-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { useAgentContext } from "../../lib/agent-context";
import { Card, StatCard } from "../../components/ui/Card";
import { ProfileMenu } from "../../components/ui/ProfileMenu";

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function HomeScreen() {
  const { user } = useAuth();
  const { t, isLoaded } = useLanguage();
  const agentCtx = useAgentContext();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [showStats, setShowStats] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    agentCtx.updateScreen("home");
    getAnalytics()
      .then(setAnalytics)
      .catch((error) => {
        console.error("[Analytics] Failed to load analytics:", error);
      });
    // Entrance animation
    const entranceAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    entranceAnimation.start();

    return () => {
      entranceAnimation.stop();
    };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("home.greetingMorning")
      : hour < 17
        ? t("home.greetingAfternoon")
        : t("home.greetingEvening");

  if (!isLoaded) return null;

  const QUICK_PROMPTS: {
    icon: IoniconName;
    label: string;
    prompt: string;
    color: string;
  }[] = [
    {
      icon: "sunny",
      label: "Daily Briefing",
      prompt:
        "Give me my daily fishing briefing - weather, best zones, market prices, and safety alerts.",
      color: COLORS.secondary,
    },
    {
      icon: "cash",
      label: "Market Prices",
      prompt:
        "What are today's fish market prices? Which species are trending up?",
      color: "#06b6d4",
    },
    {
      icon: "navigate",
      label: "Best Zones",
      prompt: "What are the best fishing zones near me right now?",
      color: COLORS.accent,
    },
    {
      icon: "warning",
      label: "Safety Alerts",
      prompt:
        "Are there any active safety alerts or weather warnings near my location?",
      color: "#ef4444",
    },
  ];

  const TOOLS: {
    icon: IoniconName;
    title: string;
    desc: string;
    route: Href;
    color: string;
  }[] = [
    {
      icon: "camera",
      title: t("nav.upload"),
      desc: t("home.toolUploadDesc"),
      route: "/upload",
      color: COLORS.primary,
    },
    {
      icon: "map",
      title: t("nav.oceanMap"),
      desc: t("home.toolMapDesc"),
      route: "/map",
      color: COLORS.secondary,
    },
    {
      icon: "time",
      title: "History",
      desc: "Past catches & records",
      route: "/history",
      color: "#7c3aed",
    },
    {
      icon: "bar-chart",
      title: t("nav.analytics"),
      desc: t("home.toolAnalyticsDesc"),
      route: "/analytics",
      color: COLORS.accent,
    },
  ];

  // Proactive greeting based on time and context
  const getProactiveGreeting = () => {
    if (hour < 6)
      return "Early start today! Here's what I've prepared for your trip.";
    if (hour < 10)
      return "Good morning! I've checked the weather and tides for you.";
    if (hour < 14)
      return "How's the catch going? I can check market prices for you.";
    if (hour < 18)
      return "Afternoon update ready - market prices and tomorrow's forecast.";
    return "Great day on the water! Let me help you log your catch.";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-[12px] color-[#64748b] font-medium">{greeting}</Text>
            <Text className="text-[17px] color-[#f8fafc] font-bold">{user?.name ?? "Fisherman"}</Text>
          </View>
          <ProfileMenu size={36} />
        </View>

        {/* Proactive Agent Greeting Bubble */}
        <Animated.View
          className="bg-[#2a1b54] rounded-[20px] p-4 mb-8 flex-row items-center border border-[#7c3aed40] shadow-lg"
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <TouchableOpacity
            className="flex-1 flex-row items-center space-x-3.5"
            onPress={() => router.push("/(tabs)/chat")}
            activeOpacity={0.85}
          >
            <View className="relative">
              <View className="w-11 h-11 rounded-full bg-[#7c3aed] items-center justify-center shadow-md">
                <Ionicons name="chatbubble" size={20} color="#fff" />
              </View>
              <View className="absolute bottom-0 right-0 w-[14px] h-[14px] rounded-full bg-[#10b981] border-[2.5px] border-[#2a1b54]" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center pb-1">
                <Text className="text-[17px] color-white font-bold tracking-tight">Matsya AI</Text>
                <View className="bg-[#7c3aed30] px-[6px] py-[2px] rounded border border-[#7c3aed50] ml-2">
                  <Text className="text-[10px] color-[#a78bfa] font-extrabold uppercase tracking-wide">AI</Text>
                </View>
              </View>
              <Text className="text-[14px] color-[#e2e8f0] leading-5 pr-2">{getProactiveGreeting()}</Text>
              <Text className="text-[12px] color-[#a78bfa] font-medium tracking-wide mt-2">Tap to continue →</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Ask Agent Prompts - Conversation starters */}
        <Text className="text-[15px] color-white font-bold mb-3 ml-1 tracking-wide uppercase">What can I help with?</Text>
        <View className="gap-2 mb-6">
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity
              key={p.label}
              className="flex-row items-center bg-[#1e293b] rounded-[14px] p-3 border border-[#334155]"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/chat",
                  params: { initialMessage: p.prompt },
                })
              }
              activeOpacity={0.75}
            >
              <View
                 className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                 style={{ backgroundColor: p.color + "18" }}
              >
                <Ionicons name={p.icon} size={18} color={p.color} />
              </View>
              <View className="flex-1 justify-center mr-2">
                <Text className="text-[15px] color-white font-semibold mb-[2px]">{p.label}</Text>
                <Text className="text-[13px] color-[#94a3b8]" numberOfLines={1}>
                  {p.prompt.split("?")[0]}?
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color="#64748b"
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats - Collapsible */}
        <TouchableOpacity
          className="flex-row items-center justify-between mb-2 mt-1"
          onPress={() => setShowStats(!showStats)}
          activeOpacity={0.7}
        >
          <Text className="text-[13px] color-[#f8fafc] font-semibold mb-2 mt-1">{t("home.overview")}</Text>
          <Ionicons
            name={showStats ? "chevron-up" : "chevron-down"}
            size={16}
            color="#64748b"
          />
        </TouchableOpacity>

        {showStats && (
          <View className="flex-row flex-wrap gap-2 mb-6">
            <StatCard
              label={t("home.statEarnings")}
              value={
                analytics
                  ? `₹${(analytics.totalEarnings / 1000).toFixed(0)}K`
                  : "-"
              }
              icon={<Ionicons name="cash" size={20} color="#047857" />}
              accentColor="#047857"
              className="w-[47%] grow"
            />
            <StatCard
              label={t("home.statCatches")}
              value={analytics ? `${analytics.totalCatches}` : "-"}
              icon={<Ionicons name="fish" size={20} color="#1e40af" />}
              accentColor="#1e40af"
              className="w-[47%] grow"
            />
            <StatCard
              label={t("home.statZones")}
              value="12"
              icon={<Ionicons name="boat" size={20} color="#d97706" />}
              accentColor="#d97706"
              className="w-[47%] grow"
            />
            <StatCard
              label={t("home.statEco")}
              value="88/100"
              icon={<Ionicons name="leaf" size={20} color="#06b6d4" />}
              accentColor="#06b6d4"
              className="w-[47%] grow"
            />
          </View>
        )}

        {/* Compact stats when collapsed */}
        {!showStats && analytics && (
          <View className="flex-row items-center justify-around bg-[#1e293b] rounded-2xl border border-[#334155] py-2.5 px-4 mb-6">
            <View className="flex-row items-center gap-1">
              <Ionicons name="cash" size={14} color="#047857" />
              <Text className="text-[12px] font-bold color-[#f8fafc]">
                ₹{(analytics.totalEarnings / 1000).toFixed(0)}K
              </Text>
            </View>
            <View className="w-[1px] h-4 bg-[#334155]" />
            <View className="flex-row items-center gap-1">
              <Ionicons name="fish" size={14} color="#1e40af" />
              <Text className="text-[12px] font-bold color-[#f8fafc]">{analytics.totalCatches}</Text>
            </View>
            <View className="w-[1px] h-4 bg-[#334155]" />
            <View className="flex-row items-center gap-1">
              <Ionicons name="boat" size={14} color="#d97706" />
              <Text className="text-[12px] font-bold color-[#f8fafc]">12</Text>
            </View>
            <View className="w-[1px] h-4 bg-[#334155]" />
            <View className="flex-row items-center gap-1">
              <Ionicons name="leaf" size={14} color="#06b6d4" />
              <Text className="text-[12px] font-bold color-[#f8fafc]">88</Text>
            </View>
          </View>
        )}

        {/* Tools */}
        <Text className="mb-2 mt-1 text-[15px] font-semibold text-[#f8fafc]">{t("home.tools")}</Text>
        <View className="mb-6 flex-row flex-wrap gap-2">
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.title}
              className="w-[47%] flex-grow rounded-[16px] border bg-[#1e293b] p-3 gap-1"
              style={{ borderColor: tool.color + "30" }}
              onPress={() => router.push(tool.route)}
              activeOpacity={0.8}
            >
              <View
                className="mb-1 h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: tool.color + "18" }}
              >
                <Ionicons name={tool.icon} size={18} color={tool.color} />
              </View>
              <Text className="text-[13px] font-semibold text-[#f8fafc]">{tool.title}</Text>
              <Text className="text-[12px] text-[#94a3b8]">{tool.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Insights */}
        
      </ScrollView>
    </SafeAreaView>
  );
}
