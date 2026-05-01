/**
 * GroupFishPickerModal - Two-step picker for weight estimation:
 *   Step 1: Select a group from the user's analysis history
 *   Step 2: Select a specific fish within that group
 *
 * Fetches groups from both online (API) and offline (local history) sources.
 * Once a fish is selected, calls `onSelectFish` with the full context needed
 * by the weight estimation flow.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "../ui/Modal";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useNetwork } from "../../lib/network-context";

// ── Types ───────────────────────────────────────────────────────────────────────

/** A unified fish entry extracted from a group's analysis. */
export interface GroupFishEntry {
  fishIndex: number;
  species: string;
  confidence: number;
  diseaseStatus: string;
  cropUrl?: string;
  /** Existing weight in grams if already measured. */
  existingWeightG?: number;
}

/** A unified group entry (online or offline). */
export interface GroupEntry {
  groupId: string;
  /** "online" for API groups, "offline" for local-history groups */
  source: "online" | "offline";
  fishCount: number;
  createdAt: string;
  /** Top species in the group (for display) */
  topSpecies: string;
  /** Thumbnail URL (first image) - may be undefined for offline */
  thumbnailUrl?: string;
  /** The fish entries within this group */
  fish: GroupFishEntry[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Called when the user selects a specific fish.
   * Provides everything needed to open the WeightEstimateModal and save the
   * weight back to the database.
   */
  onSelectFish: (params: {
    groupId: string;
    source: "online" | "offline";
    fishIndex: number;
    species: string;
    cropUrl?: string;
  }) => void;
}

type Step = "groups" | "fish";

// ── Component ──────────────────────────────────────────────────────────────────

export function GroupFishPickerModal({ visible, onClose, onSelectFish }: Props) {
  const { effectiveMode } = useNetwork();
  const [step, setStep] = useState<Step>("groups");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load groups on open ──
  useEffect(() => {
    if (visible) {
      setStep("groups");
      setSelectedGroup(null);
      setError(null);
      loadGroups();
    }
  }, [visible]);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    const combined: GroupEntry[] = [];

    try {
      // Load online groups
      if (effectiveMode === "online") {
        try {
          const { getGroups, getGroupDetails } = await import("../../lib/api-client");
          const response = await getGroups(20);
          const completedGroups = response.groups.filter(
            (g) => g.status === "completed" || g.status === "partial"
          );

          for (const group of completedGroups) {
            const fish: GroupFishEntry[] = [];
            let topSpecies = "Unknown";

            // Try to extract fish from analysisResult if present
            if (group.analysisResult) {
              const detections = group.analysisResult.detections || [];
              if (detections.length > 0) {
                detections.forEach((d, i) => {
                  fish.push({
                    fishIndex: i,
                    species: d.species,
                    confidence: d.confidence,
                    diseaseStatus: d.diseaseStatus,
                    cropUrl: d.cropUrl,
                    existingWeightG: d.weight > 0 ? d.weight : undefined,
                  });
                });
              } else {
                // Build from images → crops
                const images = group.analysisResult.images || [];
                let idx = 0;
                for (const img of images) {
                  if (img.error) continue;
                  for (const crop of Object.values(img.crops || {})) {
                    fish.push({
                      fishIndex: idx,
                      species: crop.species?.label || "Unknown",
                      confidence: crop.species?.confidence || 0,
                      diseaseStatus: crop.disease?.label || "Healthy",
                      cropUrl: crop.crop_url,
                    });
                    idx++;
                  }
                }
              }

              // Determine top species
              const speciesDist = group.analysisResult.aggregateStats?.speciesDistribution;
              if (speciesDist) {
                topSpecies = Object.entries(speciesDist).sort(
                  (a, b) => b[1] - a[1]
                )[0]?.[0] || "Unknown";
              } else if (fish.length > 0) {
                topSpecies = fish[0].species;
              }
            } else {
              // No analysis result embedded, try fetching details
              try {
                const details = await getGroupDetails(group.groupId);
                if (details.analysisResult) {
                  const detections = details.analysisResult.detections || [];
                  if (detections.length > 0) {
                    detections.forEach((d, i) => {
                      fish.push({
                        fishIndex: i,
                        species: d.species,
                        confidence: d.confidence,
                        diseaseStatus: d.diseaseStatus,
                        cropUrl: d.cropUrl,
                        existingWeightG: d.weight > 0 ? d.weight : undefined,
                      });
                    });
                  } else {
                    const images = details.analysisResult.images || [];
                    let idx = 0;
                    for (const img of images) {
                      if (img.error) continue;
                      for (const crop of Object.values(img.crops || {})) {
                        fish.push({
                          fishIndex: idx,
                          species: crop.species?.label || "Unknown",
                          confidence: crop.species?.confidence || 0,
                          diseaseStatus: crop.disease?.label || "Healthy",
                          cropUrl: crop.crop_url,
                        });
                        idx++;
                      }
                    }
                  }
                  const speciesDist = details.analysisResult.aggregateStats?.speciesDistribution;
                  if (speciesDist) {
                    topSpecies = Object.entries(speciesDist).sort(
                      (a, b) => b[1] - a[1]
                    )[0]?.[0] || "Unknown";
                  } else if (fish.length > 0) {
                    topSpecies = fish[0].species;
                  }
                }
              } catch {
                // Skip groups whose details we can't fetch
              }
            }

            // Only include groups that have at least one fish
            if (fish.length > 0) {
              combined.push({
                groupId: group.groupId,
                source: "online",
                fishCount: fish.length,
                createdAt: group.createdAt,
                topSpecies,
                thumbnailUrl: group.presignedViewUrls?.[0],
                fish,
              });
            }
          }
        } catch (e) {
          console.warn("[GroupFishPicker] Failed to load online groups:", e);
        }
      }

      // Load offline (local history) groups
      try {
        const { getLocalHistory } = await import("../../lib/local-history");
        const localRecords = await getLocalHistory();

        for (const record of localRecords) {
          const fish: GroupFishEntry[] = [];

          if (record.sessionType === "group" && record.images) {
            let idx = 0;
            for (const img of record.images) {
              for (const det of img.detections) {
                fish.push({
                  fishIndex: idx,
                  species: det.species,
                  confidence: det.speciesConfidence,
                  diseaseStatus: det.disease,
                  cropUrl: det.cropUri,
                  existingWeightG: det.weightG > 0 ? det.weightG : undefined,
                });
                idx++;
              }
            }
          } else if (record.sessionType === "single" && record.detections) {
            record.detections.forEach((det, i) => {
              fish.push({
                fishIndex: i,
                species: det.species,
                confidence: det.speciesConfidence,
                diseaseStatus: det.disease,
                cropUrl: det.cropUri,
                existingWeightG: det.weightG > 0 ? det.weightG : undefined,
              });
            });
          }

          if (fish.length > 0) {
            const topSpecies = Object.entries(record.speciesDistribution || {}).sort(
              (a, b) => b[1] - a[1]
            )[0]?.[0] || fish[0]?.species || "Unknown";

            combined.push({
              groupId: record.id,
              source: "offline",
              fishCount: fish.length,
              createdAt: record.createdAt,
              topSpecies,
              fish,
            });
          }
        }
      } catch (e) {
        console.warn("[GroupFishPicker] Failed to load local history:", e);
      }

      // Sort by most recent first
      combined.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setGroups(combined);

      if (combined.length === 0) {
        setError("No analysis groups found. Scan some fish first to estimate their weight.");
      }
    } catch (e) {
      console.error("[GroupFishPicker] Error loading groups:", e);
      setError("Failed to load groups. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [effectiveMode]);

  const handleSelectGroup = (group: GroupEntry) => {
    setSelectedGroup(group);
    setStep("fish");
  };

  const handleBack = () => {
    setStep("groups");
    setSelectedGroup(null);
  };

  const handleSelectFish = (fish: GroupFishEntry) => {
    if (!selectedGroup) return;
    onSelectFish({
      groupId: selectedGroup.groupId,
      source: selectedGroup.source,
      fishIndex: fish.fishIndex,
      species: fish.species,
      cropUrl: fish.cropUrl,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / 3600000;
      const diffDays = diffMs / 86400000;
      if (diffHours < 1) return "Just now";
      if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
      if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
      return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    } catch {
      return "Unknown";
    }
  };

  const title = step === "groups" ? "Select Analysis Group" : "Select Fish to Weigh";

  return (
    <Modal visible={visible} onClose={onClose} title={title} size="lg">
      {/* Back button on fish step */}
      {step === "fish" && selectedGroup && (
        <TouchableOpacity
          className="mb-4 flex-row items-center gap-2 border-b border-[#334155] py-2 px-1"
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={16} color={COLORS.primaryLight} />
          <Text className="text-[14px] font-medium text-[#3b82f6]">Back to groups</Text>
        </TouchableOpacity>
      )}

      {/* Loading state */}
      {loading && (
        <View className="flex-1 justify-center items-center p-xl min-h-[300px]">
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
          <Text className="text-[12px] text-textMuted mt-md">Loading your catch history…</Text>
        </View>
      )}

      {/* Error state */}
      {!loading && error && (
        <View className="flex-1 justify-center items-center p-xl min-h-[300px]">
          <Ionicons name="fish-outline" size={48} color={COLORS.textSubtle} />
          <Text className="text-[12px] text-textMuted mt-xs text-center">{error}</Text>
          <TouchableOpacity
            className="mt-lg bg-primary px-lg py-sm rounded-lg flex-row items-center"
            onPress={loadGroups}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color={COLORS.primaryLight} />
            <Text className="ml-2 text-sm font-medium text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step: Group selection ── */}
      {!loading && !error && step === "groups" && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-4 text-[13px] text-[#94a3b8]">
            Choose the scan group that contains the fish you want to weigh.
          </Text>
          {groups.map((group) => (
            <TouchableOpacity
              key={`${group.source}-${group.groupId}`}
              className="mb-3 flex-row items-center rounded-xl border border-[#334155] bg-[#1e293b] p-3"
              onPress={() => handleSelectGroup(group)}
              activeOpacity={0.7}
            >
              {group.thumbnailUrl ? (
                <Image
                  source={{ uri: group.thumbnailUrl }}
                  className="mr-4 h-[60px] w-[60px] rounded-lg"
                  resizeMode="cover"
                />
              ) : (
                <View className="mr-4 h-[60px] w-[60px] items-center justify-center rounded-lg bg-[#0f172a]">
                  <Ionicons name="images" size={22} color={COLORS.primaryLight} />
                </View>
              )}
              <View className="flex-1 justify-center">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="mr-2 flex-1 text-[15px] font-bold text-[#f8fafc]" numberOfLines={1}>
                    {group.topSpecies}
                  </Text>
                  <View
                    className={
                      group.source === "offline"
                        ? "rounded-md border border-[#f59e0b66] bg-[#f59e0b33] px-2 py-0.5"
                        : "rounded-md border border-[#3b82f666] bg-[#3b82f633] px-2 py-0.5"
                    }
                  >
                    <Text
                      className={
                        group.source === "offline"
                          ? "text-[10px] font-bold uppercase tracking-wider text-[#f59e0b]"
                          : "text-[10px] font-bold uppercase tracking-wider text-[#3b82f6]"
                      }
                    >
                      {group.source === "online" ? "Cloud" : "Local"}
                    </Text>
                  </View>
                </View>
                <Text className="text-[12px] text-[#94a3b8]">
                  {group.fishCount} fish · {formatDate(group.createdAt)}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textSubtle}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Step: Fish selection ── */}
      {!loading && !error && step === "fish" && selectedGroup && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Group summary badge */}
          <View className="mb-4 flex-row items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b] p-3">
            <Ionicons name="images-outline" size={14} color={COLORS.textMuted} />
            <Text className="flex-1 text-[12px] font-medium text-[#e2e8f0]">
              {selectedGroup.topSpecies} · {selectedGroup.fishCount} fish ·{" "}
              {formatDate(selectedGroup.createdAt)}
            </Text>
          </View>

          <Text className="mb-4 text-[13px] text-[#94a3b8]">
            Select the fish you want to estimate the weight for.
          </Text>

          {selectedGroup.fish.map((fish) => {
            const hasMeasurement = fish.existingWeightG !== undefined && fish.existingWeightG > 0;
            return (
              <TouchableOpacity
                key={fish.fishIndex}
                className={
                  hasMeasurement
                    ? "mb-3 flex-row items-center rounded-xl border border-[#10b98166] bg-[#10b98111] p-3"
                    : "mb-3 flex-row items-center rounded-xl border border-[#334155] bg-[#1e293b] p-3"
                }
                onPress={() => handleSelectFish(fish)}
                activeOpacity={0.7}
              >
                {fish.cropUrl ? (
                  <Image
                    source={{ uri: fish.cropUrl }}
                    className="mr-3 h-[50px] w-[50px] rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="mr-3 h-[50px] w-[50px] items-center justify-center rounded-lg bg-[#0f172a]">
                    <Ionicons
                      name="fish"
                      size={20}
                      color={COLORS.primaryLight}
                    />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    Fish #{fish.fishIndex + 1}
                  </Text>
                  <Text className="mb-[2px] text-[13px] font-semibold text-[#f8fafc]">{fish.species}</Text>
                  <Text className="mt-1 flex-row items-center gap-2 text-[12px] text-[#94a3b8]">
                    {(fish.confidence * 100).toFixed(0)}% conf · {fish.diseaseStatus}
                  </Text>
                </View>
                <View className="items-end justify-center pl-2">
                  {hasMeasurement ? (
                    <View className="flex-row items-center gap-[4px] rounded-sm bg-[#10b98115] px-[6px] py-[2px]">
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={COLORS.success}
                      />
                      <Text className="text-[12px] font-bold text-[#10b981]">
                        {(fish.existingWeightG! / 1000).toFixed(2)} kg
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-1 rounded-lg border border-[#3b82f644] bg-[#3b82f622] px-2 py-1.5">
                      <Ionicons
                        name="scale-outline"
                        size={16}
                        color={COLORS.primaryLight}
                      />
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-[#3b82f6]">Weigh</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </Modal>
  );
}
