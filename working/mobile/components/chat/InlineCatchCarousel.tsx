/**
 * InlineCatchCarousel - Horizontal carousel of recent catches rendered inside
 * a chat bubble when the agent returns ui.history = true.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface CatchCard {
  groupId: string;
  fishCount: number;
  topSpecies: string;
  totalWeight: number;
  totalValue: number;
  createdAt: string;
  thumbnailUrl?: string;
}

interface Props {
  onAskAboutCatch?: (groupId: string, species: string) => void;
}

export function InlineCatchCarousel({ onAskAboutCatch }: Props) {
  const [catches, setCatches] = useState<CatchCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentCatches();
  }, []);

  const loadRecentCatches = async () => {
    try {
      const { getGroups } = await import("../../lib/api-client");
      const response = await getGroups(5);
      const cards: CatchCard[] = response.groups.map((g: any) => {
        const stats = g.analysisResult?.aggregateStats;
        const dist = stats?.speciesDistribution || {};
        const topSpecies =
          Object.entries(dist).sort(
            ([, a], [, b]) => (b as number) - (a as number),
          )[0]?.[0] || "Unknown";

        return {
          groupId: g.groupId,
          fishCount: stats?.totalFishCount ?? g.imageCount ?? 0,
          topSpecies,
          totalWeight: stats?.totalEstimatedWeight ?? 0,
          totalValue: stats?.totalEstimatedValue ?? 0,
          createdAt: g.createdAt,
          thumbnailUrl: undefined,
        };
      });
      setCatches(cards);
    } catch (err) {
      console.warn("Failed to load catches for carousel:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.primaryLight} />
        <Text style={styles.loadingText}>Loading catches...</Text>
      </View>
    );
  }

  if (catches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="fish-outline" size={24} color={COLORS.textSubtle} />
        <Text style={styles.emptyText}>No catches recorded yet</Text>
      </View>
    );
  }

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="time" size={14} color={COLORS.primaryLight} />
        <Text style={styles.headerText}>Recent Catches</Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/history")}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={{ maxHeight: 250 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerStyle={styles.scrollContent}
      >
        {catches.map((c) => (
          <TouchableOpacity
            key={c.groupId}
            style={styles.card}
            onPress={() => onAskAboutCatch?.(c.groupId, c.topSpecies)}
            activeOpacity={0.8}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIcon}>
                <Ionicons name="fish" size={18} color={COLORS.primaryLight} />
              </View>
              <Text style={styles.fishCount}>{c.fishCount} fish</Text>
            </View>
            <Text style={styles.species} numberOfLines={1}>
              {c.topSpecies}
            </Text>
            <View style={styles.cardStats}>
              <Text style={styles.statText}>{c.totalWeight.toFixed(1)}kg</Text>
              <Text style={styles.statDivider}>•</Text>
              <Text style={styles.statText}>₹{Math.round(c.totalValue)}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(c.createdAt)}</Text>
            <View style={styles.askBadge}>
              <Ionicons
                name="chatbubble"
                size={10}
                color={COLORS.primaryLight}
              />
              <Text style={styles.askBadgeText}>Ask AI</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  viewAllText: { fontSize: 11, color: COLORS.primaryLight, fontWeight: "600" },
  scrollContent: { paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  card: {
    width: "100%",
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  cardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  fishCount: { fontSize: 11, color: COLORS.textMuted, fontWeight: "500" },
  species: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  statText: { fontSize: 11, color: COLORS.secondaryLight, fontWeight: "600" },
  statDivider: { fontSize: 11, color: COLORS.textSubtle },
  dateText: { fontSize: 10, color: COLORS.textSubtle },
  askBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: COLORS.primary + "20",
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  askBadgeText: { fontSize: 9, color: COLORS.primaryLight, fontWeight: "600" },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  emptyContainer: {
    alignItems: "center",
    gap: 6,
    padding: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  emptyText: { fontSize: 12, color: COLORS.textMuted },
});
