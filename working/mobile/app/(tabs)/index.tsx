import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
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
      .catch(() => {});
    // Entrance animation
    const entranceAnimation = Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
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
    route: string;
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
    if (hour < 6) return "Early start today! Here's what I've prepared for your trip.";
    if (hour < 10) return "Good morning! I've checked the weather and tides for you.";
    if (hour < 14) return "How's the catch going? I can check market prices for you.";
    if (hour < 18) return "Afternoon update ready - market prices and tomorrow's forecast.";
    return "Great day on the water! Let me help you log your catch.";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.userName}>{user?.name ?? "Fisherman"}</Text>
          </View>
          <ProfileMenu size={36} />
        </View>

        {/* Proactive Agent Greeting Bubble */}
        <Animated.View style={[styles.agentGreeting, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity
            style={styles.agentGreetingInner}
            onPress={() => router.push("/(tabs)/chat")}
            activeOpacity={0.85}
          >
            <View style={styles.agentAvatarWrap}>
              <View style={styles.agentAvatar}>
                <Ionicons name="chatbubble" size={18} color="#fff" />
              </View>
              <View style={styles.agentOnlineDot} />
            </View>
            <View style={styles.agentGreetingContent}>
              <View style={styles.agentNameRow}>
                <Text style={styles.agentName}>SagarMitra</Text>
                <View style={styles.aiTag}>
                  <Text style={styles.aiTagText}>AI</Text>
                </View>
              </View>
              <Text style={styles.agentMessage}>{getProactiveGreeting()}</Text>
              <Text style={styles.agentTapHint}>Tap to continue →</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Ask Agent Prompts - Conversation starters */}
        <Text style={styles.sectionTitle}>What can I help with?</Text>
        <View style={styles.promptGrid}>
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity
              key={p.label}
              style={styles.promptCard}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/chat",
                  params: { initialMessage: p.prompt },
                })
              }
              activeOpacity={0.75}
            >
              <View
                style={[styles.promptIcon, { backgroundColor: p.color + "18" }]}
              >
                <Ionicons name={p.icon} size={18} color={p.color} />
              </View>
              <View style={styles.promptTextWrap}>
                <Text style={styles.promptLabel}>{p.label}</Text>
                <Text style={styles.promptDesc} numberOfLines={1}>{p.prompt.split("?")[0]}?</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats - Collapsible */}
        <TouchableOpacity
          style={styles.statsToggle}
          onPress={() => setShowStats(!showStats)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>{t("home.overview")}</Text>
          <Ionicons name={showStats ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textMuted} />
        </TouchableOpacity>

        {showStats && (
          <View style={styles.statsGrid}>
            <StatCard
              label={t("home.statEarnings")}
              value={
                analytics
                  ? `₹${(analytics.totalEarnings / 1000).toFixed(0)}K`
                  : "-"
              }
              icon={<Ionicons name="cash" size={20} color={COLORS.secondary} />}
              accentColor={COLORS.secondary}
              style={styles.statCard}
            />
            <StatCard
              label={t("home.statCatches")}
              value={analytics ? `${analytics.totalCatches}` : "-"}
              icon={<Ionicons name="fish" size={20} color={COLORS.primary} />}
              accentColor={COLORS.primary}
              style={styles.statCard}
            />
            <StatCard
              label={t("home.statZones")}
              value="12"
              icon={<Ionicons name="boat" size={20} color={COLORS.accent} />}
              accentColor={COLORS.accent}
              style={styles.statCard}
            />
            <StatCard
              label={t("home.statEco")}
              value="88/100"
              icon={<Ionicons name="leaf" size={20} color="#06b6d4" />}
              accentColor="#06b6d4"
              style={styles.statCard}
            />
          </View>
        )}

        {/* Compact stats when collapsed */}
        {!showStats && analytics && (
          <View style={styles.statsStrip}>
            <View style={styles.stripItem}>
              <Ionicons name="cash" size={14} color={COLORS.secondary} />
              <Text style={styles.stripValue}>₹{(analytics.totalEarnings / 1000).toFixed(0)}K</Text>
            </View>
            <View style={styles.stripDivider} />
            <View style={styles.stripItem}>
              <Ionicons name="fish" size={14} color={COLORS.primary} />
              <Text style={styles.stripValue}>{analytics.totalCatches}</Text>
            </View>
            <View style={styles.stripDivider} />
            <View style={styles.stripItem}>
              <Ionicons name="boat" size={14} color={COLORS.accent} />
              <Text style={styles.stripValue}>12</Text>
            </View>
            <View style={styles.stripDivider} />
            <View style={styles.stripItem}>
              <Ionicons name="leaf" size={14} color="#06b6d4" />
              <Text style={styles.stripValue}>88</Text>
            </View>
          </View>
        )}

        {/* Tools */}
        <Text style={styles.sectionTitle}>{t("home.tools")}</Text>
        <View style={styles.toolsGrid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.title}
              style={[styles.toolCard, { borderColor: tool.color + "30" }]}
              onPress={() => router.push(tool.route as any)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.toolIcon,
                  { backgroundColor: tool.color + "18" },
                ]}
              >
                <Ionicons name={tool.icon} size={18} color={tool.color} />
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDesc}>{tool.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Insights */}
        <Text style={styles.sectionTitle}>{t("home.insights")}</Text>
        <Card style={styles.insightCard} padding={SPACING.md}>
          {[
            {
              icon: "time-outline" as IoniconName,
              label: t("home.insightTime"),
              value: "5:00–8:00 AM",
            },
            {
              icon: "fish-outline" as IoniconName,
              label: t("home.insightSpecies"),
              value: analytics?.topSpecies ?? "Indian Pomfret",
            },
            {
              icon: "leaf-outline" as IoniconName,
              label: t("home.insightSustainability"),
              value: "88/100",
            },
            {
              icon: "trending-up-outline" as IoniconName,
              label: t("home.insightMarket"),
              value: "Pomfret ↑12%",
            },
          ].map((item, i) => (
            <View
              key={item.label}
              style={[styles.insightRow, i > 0 && styles.insightRowBorder]}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={COLORS.primaryLight}
                style={{ marginRight: SPACING.sm }}
              />
              <Text style={styles.insightLabel}>{item.label}</Text>
              <Text style={styles.insightValue}>{item.value}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING["3xl"] },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  userName: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: FONTS.sizes.base,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },

  /* Agent Proactive Greeting */
  agentGreeting: {
    marginBottom: SPACING.lg,
  },
  agentGreetingInner: {
    flexDirection: "row",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primaryLight + "25",
    padding: SPACING.md,
    alignItems: "flex-start",
    gap: 12,
  },
  agentAvatarWrap: {
    position: "relative",
  },
  agentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primaryLight + "40",
  },
  agentOnlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4ade80",
    borderWidth: 2,
    borderColor: COLORS.bgCard,
  },
  agentGreetingContent: {
    flex: 1,
  },
  agentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  agentName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  aiTag: {
    backgroundColor: COLORS.primaryLight + "20",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  aiTagText: {
    fontSize: 8,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
    letterSpacing: 0.5,
  },
  agentMessage: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  agentTapHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primaryLight + "80",
    fontWeight: FONTS.weights.medium,
  },

  /* Quick ask prompts - vertical list style */
  promptGrid: {
    gap: 8,
    marginBottom: SPACING.lg,
  },
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  promptIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  promptTextWrap: {
    flex: 1,
  },
  promptLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  promptDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  /* Stats toggle */
  statsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  /* Stats strip (collapsed) */
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  stripItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stripValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  stripDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.border,
  },

  sectionTitle: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: { width: "47%", flexGrow: 1 },

  /* Tools grid */
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  toolCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: 4,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  toolTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  toolDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },

  /* Insights */
  insightCard: { marginBottom: SPACING.lg },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  insightRowBorder: { borderTopWidth: 1, borderColor: COLORS.border },
  insightLabel: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  insightValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
});
