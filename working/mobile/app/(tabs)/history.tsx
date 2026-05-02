import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/core";
import { getGroups, deleteGroup, getGroupDetails } from "../../lib/api-client";
import { HistoryCard } from "../../components/history/HistoryCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Ionicons } from "@expo/vector-icons";
import type { GroupRecord } from "../../lib/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getLocalHistory,
  getPendingLocalRecords,
  deleteLocalRecord,
  type LocalHistoryRecord,
} from "../../lib/local-history";
import { setAnalysisData } from "../../lib/analysis-store";
import { useNetwork } from "../../lib/network-context";
import { ProfileMenu } from "../../components/ui/ProfileMenu";

const HISTORY_CACHE_KEY = "ocean_ai_history_cache";

/** Convert a local offline record to the GroupRecord shape HistoryCard expects */
function localToGroupRecord(r: LocalHistoryRecord): GroupRecord {
  const allDetections =
    r.sessionType === "group"
      ? r.images?.flatMap((img) => img.detections) || []
      : r.detections || [];

  return {
    groupId: `local_${r.id}`,
    userId: "",
    imageCount: r.sessionType === "group" ? r.images?.length || 0 : 1,
    s3Keys: [],
    status: r.syncStatus === "syncing" ? "processing" : "completed",
    createdAt: r.createdAt,
    latitude: r.location?.lat,
    longitude: r.location?.lng,
    analysisResult: {
      images: [],
      aggregateStats: {
        totalFishCount: r.fishCount,
        averageConfidence: r.avgConfidence,
        totalEstimatedWeight:
          allDetections.reduce((s, d) => s + (d.weightG ?? 0), 0) / 1000,
        totalEstimatedValue: allDetections.reduce(
          (s, d) => s + (d.estimatedValue ?? 0),
          0,
        ),
        diseaseDetected: r.diseaseDetected,
        speciesDistribution: r.speciesDistribution,
      },
      processedAt: r.createdAt,
    },
  };
}

export default function HistoryScreen() {
  const { isOnline } = useNetwork();
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [localRecords, setLocalRecords] = useState<LocalHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // true when we're showing cached cloud data (offline fallback)
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  // Cache of groupId -> presignedViewUrls for thumbnail previews
  const [thumbnailCache, setThumbnailCache] = useState<
    Record<string, string[]>
  >({});

  // Reload local records whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      loadLocalRecords();
    }, []),
  );

  useEffect(() => {
    loadCloudHistory();
    loadLocalRecords();
  }, []);

  // When connectivity is restored: refresh cloud history and re-evaluate local sync status
  useEffect(() => {
    if (isOnline) {
      loadCloudHistory();
      loadLocalRecords();
    }
  }, [isOnline]);

  // Lazily fetch thumbnails for up to 5 most recent groups visible
  useEffect(() => {
    if (!isOnline || groups.length === 0) return;
    const toFetch = groups
      .slice(0, 5)
      .filter(
        (g) =>
          g.status === "completed" &&
          !thumbnailCache[g.groupId] &&
          g.imageCount > 0,
      );
    if (toFetch.length === 0) return;

    toFetch.forEach(async (g) => {
      try {
        const detail = await getGroupDetails(g.groupId);
        if (detail.presignedViewUrls && detail.presignedViewUrls.length > 0) {
          setThumbnailCache((prev) => ({
            ...prev,
            [g.groupId]: detail.presignedViewUrls!,
          }));
        }
      } catch {
        // Non-critical - just skip thumbnail for this group
      }
    });
  }, [groups, isOnline]);

  const loadLocalRecords = async () => {
    try {
      const all = await getLocalHistory();
      // Only show pending/failed - synced records already appear in cloud
      setLocalRecords(all.filter((r) => r.syncStatus !== "synced"));
    } catch (e) {
      console.warn("[History] Failed to load local records:", e);
    }
  };

  const CACHE_MAX_RECORDS = 50;

  const loadCloudHistory = async (forceRefresh = false) => {
    let loadedFromCache = false;
    try {
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
        if (cached) {
          try {
            setGroups(JSON.parse(cached));
            setLoading(false);
            loadedFromCache = true;
          } catch {
            await AsyncStorage.removeItem(HISTORY_CACHE_KEY);
          }
        }
      }
      const data = await getGroups();
      // Keep only the most recent records to bound storage usage
      const toCache = data.groups.slice(0, CACHE_MAX_RECORDS);
      setGroups(toCache);
      setIsOfflineCache(false);
      await AsyncStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(toCache));
    } catch {
      // Offline - cached cloud records are still displayed; flag it
      if (loadedFromCache) setIsOfflineCache(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadCloudHistory(true);
    loadLocalRecords();
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleViewCloudDetails = (groupId: string) => {
    router.push(`/history/${groupId}` as any);
  };

  const handleViewLocalDetails = (record: LocalHistoryRecord) => {
    const rawDetections =
      record.sessionType === "group"
        ? record.images?.[0]?.detections || []
        : record.detections || [];
    setAnalysisData({
      mode: "offline",
      offlineResults: rawDetections.map((d) => ({
        ...d,
        weightUserEntered: (d?.weightG ?? 0) > 0,
      })),
      processingTime: record.processingTime,
      imageUri:
        record.sessionType === "group"
          ? record.images?.[0]?.imageUri || ""
          : record.imageUri || "",
      location: record.location,
    });
    router.push("/analysis/detail");
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDeleteCloud = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
      const updated = groups.filter((g) => g.groupId !== groupId);
      setGroups(updated);
      await AsyncStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  const handleDeleteLocal = async (id: string) => {
    await deleteLocalRecord(id);
    setLocalRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAskAI = (groupId: string) => {
    const group = groups.find((g) => g.groupId === groupId);
    if (group) {
      router.push({
        pathname: "/(tabs)/chat",
        params: { 
          historyGroupId: groupId,
          historyGroupDate: group.createdAt,
        },
      });
    }
  };

  const handleExportPDF = (groupId: string) => {
    console.log("Export PDF for group:", groupId);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const totalCount = groups.length + localRecords.length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <View className="flex-row items-center px-6 pt-2 pb-4 border-b border-[#334155]">
          <Text className="text-[17px] font-bold color-[#f8fafc]">History</Text>
          <Text className="text-[10px] color-[#94a3b8] mt-[2px]">Loading...</Text>
        </View>
        <View className="p-6">
          <SkeletonList itemCount={5} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View className="flex-row items-center px-6 pt-2 pb-4 border-b border-[#334155]">
        <View style={{ flex: 1 }}>
          <Text className="text-[17px] font-bold color-[#f8fafc]">History</Text>
          <Text className="text-[10px] color-[#94a3b8] mt-[2px]">{totalCount} analysis sessions</Text>
        </View>
        {isOfflineCache && (
          <View className="flex-row items-center gap-1 py-1 px-2 rounded-full" style={{ backgroundColor: COLORS.warning + "18" }}>
            <Ionicons
              name="cloud-offline-outline"
              size={12}
              color={COLORS.warning}
            />
            <Text className="text-[10px] font-semibold" style={{ color: COLORS.warning }}>Cached</Text>
          </View>
        )}
        <ProfileMenu size={36} />
      </View>

      {totalCount === 0 ? (
        <EmptyState
          icon={
            <Ionicons name="time-outline" size={48} color={COLORS.textMuted} />
          }
          title="No History Yet"
          description="Your catch analysis history will appear here. Upload images to get started!"
          action={{
            label: "Upload Now",
            onPress: () => router.push("/(tabs)/upload"),
          }}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.groupId}
          ListHeaderComponent={
            localRecords.length > 0 ? (
              <View>
                <View className="flex-row items-center gap-1 mb-2 mt-1">
                  <Ionicons
                    name="phone-portrait-outline"
                    size={14}
                    color={COLORS.warning}
                  />
                  <Text className="text-[10px] font-bold color-[#94a3b8] uppercase tracking-[0.8px]">
                    Offline Analyses{" "}
                    {isOnline ? "- syncing…" : "- pending sync"}
                  </Text>
                </View>
                {localRecords.map((r) => (
                  <HistoryCard
                    key={`local_${r.id}`}
                    group={localToGroupRecord(r)}
                    offlineSyncStatus={
                      r.syncStatus === "failed" ? "failed" : "pending"
                    }
                    onViewDetails={() => handleViewLocalDetails(r)}
                    onDelete={() => handleDeleteLocal(r.id)}
                    onAskAI={() => {}}
                    onExportPDF={() => {}}
                  />
                ))}
                {groups.length > 0 && (
                  <View className="flex-row items-center gap-1 mb-2 mt-1">
                    <Ionicons
                      name="cloud-outline"
                      size={14}
                      color={COLORS.primaryLight}
                    />
                    <Text className="text-[10px] font-bold color-[#94a3b8] uppercase tracking-[0.8px]">Cloud History</Text>
                  </View>
                )}
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <HistoryCard
              group={{
                ...item,
                presignedViewUrls: thumbnailCache[item.groupId],
              }}
              onViewDetails={() => handleViewCloudDetails(item.groupId)}
              onDelete={() => handleDeleteCloud(item.groupId)}
              onAskAI={() => handleAskAI(item.groupId)}
              onExportPDF={() => handleExportPDF(item.groupId)}
            />
          )}
          contentContainerStyle={{ padding: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
