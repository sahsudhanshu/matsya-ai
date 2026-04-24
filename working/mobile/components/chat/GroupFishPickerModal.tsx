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
  StyleSheet,
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
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={16} color={COLORS.primaryLight} />
          <Text style={styles.backButtonText}>Back to groups</Text>
        </TouchableOpacity>
      )}

      {/* Loading state */}
      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
          <Text style={styles.loadingText}>Loading your catch history…</Text>
        </View>
      )}

      {/* Error state */}
      {!loading && error && (
        <View style={styles.centerContainer}>
          <Ionicons name="fish-outline" size={48} color={COLORS.textSubtle} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadGroups}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color={COLORS.primaryLight} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step: Group selection ── */}
      {!loading && !error && step === "groups" && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepHint}>
            Choose the scan group that contains the fish you want to weigh.
          </Text>
          {groups.map((group) => (
            <TouchableOpacity
              key={`${group.source}-${group.groupId}`}
              style={styles.groupRow}
              onPress={() => handleSelectGroup(group)}
              activeOpacity={0.7}
            >
              {group.thumbnailUrl ? (
                <Image
                  source={{ uri: group.thumbnailUrl }}
                  style={styles.groupThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.groupThumb, styles.groupThumbPlaceholder]}>
                  <Ionicons name="images" size={22} color={COLORS.primaryLight} />
                </View>
              )}
              <View style={styles.groupInfo}>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupSpecies} numberOfLines={1}>
                    {group.topSpecies}
                  </Text>
                  <View
                    style={[
                      styles.sourceBadge,
                      group.source === "offline" && styles.sourceBadgeOffline,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourceBadgeText,
                        group.source === "offline" && styles.sourceBadgeTextOffline,
                      ]}
                    >
                      {group.source === "online" ? "Cloud" : "Local"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.groupMeta}>
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
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Group summary badge */}
          <View style={styles.groupSummaryBadge}>
            <Ionicons name="images-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.groupSummaryText}>
              {selectedGroup.topSpecies} · {selectedGroup.fishCount} fish ·{" "}
              {formatDate(selectedGroup.createdAt)}
            </Text>
          </View>

          <Text style={styles.stepHint}>
            Select the fish you want to estimate the weight for.
          </Text>

          {selectedGroup.fish.map((fish) => {
            const hasMeasurement = fish.existingWeightG !== undefined && fish.existingWeightG > 0;
            return (
              <TouchableOpacity
                key={fish.fishIndex}
                style={[styles.fishRow, hasMeasurement && styles.fishRowMeasured]}
                onPress={() => handleSelectFish(fish)}
                activeOpacity={0.7}
              >
                {fish.cropUrl ? (
                  <Image
                    source={{ uri: fish.cropUrl }}
                    style={styles.fishThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.fishThumb, styles.fishThumbPlaceholder]}>
                    <Ionicons
                      name="fish"
                      size={20}
                      color={COLORS.primaryLight}
                    />
                  </View>
                )}
                <View style={styles.fishInfo}>
                  <Text style={styles.fishLabel}>
                    Fish #{fish.fishIndex + 1}
                  </Text>
                  <Text style={styles.fishSpecies}>{fish.species}</Text>
                  <Text style={styles.fishMeta}>
                    {(fish.confidence * 100).toFixed(0)}% conf · {fish.diseaseStatus}
                  </Text>
                </View>
                <View style={styles.fishAction}>
                  {hasMeasurement ? (
                    <View style={styles.measuredBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={COLORS.success}
                      />
                      <Text style={styles.measuredText}>
                        {(fish.existingWeightG! / 1000).toFixed(2)} kg
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.measureBadge}>
                      <Ionicons
                        name="scale-outline"
                        size={16}
                        color={COLORS.primaryLight}
                      />
                      <Text style={styles.measureText}>Weigh</Text>
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

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING["2xl"],
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryLight + "18",
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  retryText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryLight,
    fontWeight: "600" as const,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  backButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryLight,
    fontWeight: "500" as const,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },

  stepHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    lineHeight: 20,
  },

  // ── Group rows ──
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupThumb: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  groupThumbPlaceholder: {
    backgroundColor: COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
  },
  groupInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  groupSpecies: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    fontWeight: "600" as const,
    flex: 1,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight + "20",
  },
  sourceBadgeOffline: {
    backgroundColor: "#f59e0b" + "20",
  },
  sourceBadgeText: {
    fontSize: 10,
    color: COLORS.primaryLight,
    fontWeight: "600" as const,
  },
  sourceBadgeTextOffline: {
    color: "#f59e0b",
  },
  groupMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    marginTop: 2,
  },

  groupSummaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  groupSummaryText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: "500" as const,
  },

  // ── Fish rows ──
  fishRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fishRowMeasured: {
    borderColor: COLORS.success + "40",
    backgroundColor: COLORS.success + "08",
  },
  fishThumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  fishThumbPlaceholder: {
    backgroundColor: COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
  },
  fishInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  fishLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  fishSpecies: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    fontWeight: "600" as const,
  },
  fishMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
  },
  fishAction: {
    marginLeft: SPACING.sm,
  },
  measuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.success + "18",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  measuredText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.success,
    fontWeight: "600" as const,
  },
  measureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primaryLight + "18",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  measureText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primaryLight,
    fontWeight: "600" as const,
  },
});
