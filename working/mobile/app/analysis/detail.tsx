/**
 * Detailed Analysis Report
 * Shows full ML analysis data for both online (cloud) and offline (on-device) results.
 * Data is passed via the analysis-store module.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";
import {
  translateFishName,
  translateDiseaseName,
} from "../../lib/i18n/species-i18n";
import { getAnalysisData } from "../../lib/analysis-store";
import type { OfflineDetectionResult } from "../../lib/offline-inference";
import type { MLCropResult } from "../../lib/types";
import { WeightEstimateModal } from "../../components/WeightEstimateModal";
import { SyncService } from "../../lib/sync-service";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const YOLO_CONFIDENCE_THRESHOLD = 0.3;

// ─── Design constants ─────────────────────────────────────────────────────────
const CARD_PADDING = SPACING.md;
const CARD_RADIUS = RADIUS.lg;

// ─── Primitive helpers ────────────────────────────────────────────────────────

function ConfBadge({ value, label }: { value: number; label?: string }) {
  const pct = (value * 100).toFixed(1);
  const color =
    value >= 0.8
      ? COLORS.success
      : value >= 0.5
        ? COLORS.warning
        : COLORS.error;
  return (
    <View
      style={[
        s.confBadge,
        { backgroundColor: color + "1A", borderColor: color + "55" },
      ]}
    >
      <Text style={[s.confPct, { color }]}>{pct}%</Text>
      {label && (
        <Text style={[s.confLabel, { color: color + "BB" }]}>
          {label.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <View style={s.sectionDividerRow}>
      <View style={s.sectionDividerLine} />
      <Text style={s.sectionDividerText}>{title.toUpperCase()}</Text>
      <View style={s.sectionDividerLine} />
    </View>
  );
}

// ─── Fullscreen image lightbox ────────────────────────────────────────────────

function FullscreenImageViewer({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={s.lightboxOverlay}>
        <Image
          source={{ uri }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={s.lightboxCloseBtn}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.lightboxHint}>
          <Ionicons name="expand-outline" size={13} color={COLORS.textMuted} />
          <Text style={s.lightboxHintText}>Tap anywhere to close</Text>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.mono]}>{value}</Text>
    </View>
  );
}

/** Three-stat pill used in the offline report header */
function StatPill({
  iconName,
  value,
  label,
  accentColor,
}: {
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  label: string;
  accentColor: string;
}) {
  return (
    <View style={[s.statPill, { borderTopColor: accentColor }]}>
      <Ionicons
        name={iconName}
        size={20}
        color={accentColor}
        style={{ marginBottom: 4 }}
      />
      <Text style={[s.statPillValue, { color: accentColor }]}>{value}</Text>
      <Text style={s.statPillLabel}>{label}</Text>
    </View>
  );
}

// ─── Online Detailed View ─────────────────────────────────────────────────────

function OnlineDetailPage() {
  const data = getAnalysisData();
  if (!data || data.mode !== "online") return null;
  const { groupAnalysis, groupId, imageUris, location } = data;

  const [activeTab, setActiveTab] = useState(0);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const totalImages = groupAnalysis.images.length;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {viewerUri && (
        <FullscreenImageViewer
          uri={viewerUri}
          onClose={() => setViewerUri(null)}
        />
      )}
      {/* ── Identity & Meta ── */}
      <SectionDivider title="Report Identity" />
      <Card style={s.card} padding={SPACING.md}>
        <InfoRow label="Group ID" value={groupId} mono />
        <InfoRow
          label="Processed At"
          value={new Date(groupAnalysis.processedAt).toLocaleString()}
        />
        {location && (
          <InfoRow
            label="Location"
            value={`${location.lat.toFixed(5)}°N, ${location.lng.toFixed(5)}°E`}
            mono
          />
        )}
        <InfoRow label="Images" value={`${totalImages}`} />
      </Card>

      {/* ── Aggregate Stats ── */}
      <SectionDivider title="Aggregate Statistics" />
      <Card style={s.card} padding={SPACING.md}>
        <InfoRow
          label="Total Fish Detected"
          value={`${groupAnalysis.aggregateStats.totalFishCount}`}
        />
        <InfoRow
          label="Average YOLO Confidence"
          value={`${(groupAnalysis.aggregateStats.averageConfidence * 100).toFixed(1)}%`}
        />
        <InfoRow
          label="Total Estimated Weight"
          value={`${groupAnalysis.aggregateStats.totalEstimatedWeight.toFixed(3)} kg`}
        />
        <InfoRow
          label="Total Estimated Value"
          value={`₹${groupAnalysis.aggregateStats.totalEstimatedValue.toLocaleString("en-IN")}`}
        />
        <InfoRow
          label="Disease Status"
          value={
            groupAnalysis.aggregateStats.diseaseDetected
              ? "Disease Detected"
              : "All Healthy"
          }
        />
        {Object.keys(groupAnalysis.aggregateStats.speciesDistribution).length >
          0 && (
          <View style={s.speciesDist}>
            <Text style={s.speciesDistTitle}>Species Distribution</Text>
            <OnlineSpeciesDist
              dist={groupAnalysis.aggregateStats.speciesDistribution}
            />
          </View>
        )}
      </Card>

      {/* ── Image-level tabs ── */}
      <SectionDivider title="Per-Image Analysis" />

      {totalImages > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsRow}
        >
          {groupAnalysis.images.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              style={[s.tab, activeTab === idx && s.tabActive]}
              onPress={() => setActiveTab(idx)}
            >
              <Text style={[s.tabText, activeTab === idx && s.tabTextActive]}>
                Image {idx + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {groupAnalysis.images[activeTab] &&
        (() => {
          const img = groupAnalysis.images[activeTab];
          const crops = Object.entries(img.crops).filter(
            ([, crop]) => crop.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD,
          );

          return (
            <View>
              <Card style={s.card} padding={SPACING.md}>
                <InfoRow label="Image Index" value={`${img.imageIndex + 1}`} />
                <InfoRow label="S3 Key" value={img.s3Key} mono />
                {img.error && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{img.error}</Text>
                  </View>
                )}
              </Card>

              {imageUris[activeTab] && (
                <View style={s.onlineImageWrapper}>
                  <Text style={s.onlineImageLabel}>SOURCE IMAGE</Text>
                  <TouchableOpacity
                    onPress={() => setViewerUri(imageUris[activeTab])}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: imageUris[activeTab] }}
                      style={s.sourceImg}
                      resizeMode="contain"
                    />
                    <View style={s.imageExpandBadge}>
                      <Ionicons
                        name="expand-outline"
                        size={14}
                        color={COLORS.textPrimary}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {img.yolo_image_url && (
                <View style={s.onlineImageWrapper}>
                  <Text style={s.onlineImageLabel}>YOLO DETECTION OUTPUT</Text>
                  <TouchableOpacity
                    onPress={() => setViewerUri(img.yolo_image_url as string)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: img.yolo_image_url }}
                      style={s.yoloImg}
                      resizeMode="contain"
                    />
                    <View style={s.imageExpandBadge}>
                      <Ionicons
                        name="expand-outline"
                        size={14}
                        color={COLORS.textPrimary}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {crops.length === 0 ? (
                <Card style={s.card} padding={SPACING.xl}>
                  <Text style={s.emptyText}>
                    No fish met the 30% confidence threshold.
                  </Text>
                </Card>
              ) : (
                crops.map(([cropKey, crop], ci) => (
                  <OnlineCropDetail
                    key={cropKey}
                    cropKey={cropKey}
                    crop={crop}
                    index={ci}
                  />
                ))
              )}
            </View>
          );
        })()}
    </ScrollView>
  );
}

function OnlineSpeciesDist({ dist }: { dist: Record<string, number> }) {
  const { locale } = useLanguage();
  return (
    <>
      {Object.entries(dist)
        .sort(([, a], [, b]) => b - a)
        .map(([species, count]) => (
          <View key={species} style={s.speciesRow}>
            <Text style={s.speciesRowName}>
              {translateFishName(species, locale)}
            </Text>
            <Text style={s.speciesRowCount}>{count}</Text>
          </View>
        ))}
    </>
  );
}

function OnlineCropDetail({
  cropKey,
  crop,
  index,
}: {
  cropKey: string;
  crop: MLCropResult;
  index: number;
}) {
  const { locale } = useLanguage();
  const diseaseColor =
    crop.disease.label === "Healthy Fish" ? COLORS.success : COLORS.warning;
  const accentColor = COLORS.primaryLight;
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  return (
    <View style={[s.fishCard, { borderLeftColor: accentColor }]}>
      {viewerUri && (
        <FullscreenImageViewer
          uri={viewerUri}
          onClose={() => setViewerUri(null)}
        />
      )}
      {/* Header */}
      <View
        style={[s.fishCardHeader, { borderBottomColor: accentColor + "30" }]}
      >
        <View
          style={[
            s.fishNumberPill,
            {
              backgroundColor: accentColor + "20",
              borderColor: accentColor + "50",
            },
          ]}
        >
          <Text style={[s.fishNumberText, { color: accentColor }]}>
            FISH #{index + 1}
          </Text>
        </View>
        <ConfBadge value={crop.yolo_confidence} label="YOLO" />
      </View>

      {/* Species */}
      <View style={s.speciesSection}>
        <Text style={s.speciesMainName}>
          {translateFishName(crop.species.label, locale)}
        </Text>
        <Text style={s.speciesScientific}>{crop.species.label}</Text>
      </View>

      {/* Health Banner */}
      <View
        style={[
          s.healthBanner,
          {
            backgroundColor: diseaseColor + "15",
            borderColor: diseaseColor + "35",
          },
        ]}
      >
        <Ionicons
          name={
            crop.disease.label === "Healthy Fish"
              ? "checkmark-circle-outline"
              : "warning-outline"
          }
          size={20}
          color={diseaseColor}
        />
        <View style={s.healthBannerBody}>
          <Text style={s.healthBannerLabel}>HEALTH STATUS</Text>
          <Text style={[s.healthBannerValue, { color: diseaseColor }]}>
            {translateDiseaseName(crop.disease.label, locale)}
          </Text>
        </View>
        <ConfBadge value={crop.disease.confidence} label="Conf" />
      </View>

      {/* Species confidence */}
      <View style={s.inlineConfRow}>
        <Text style={s.inlineConfLabel}>Species Confidence</Text>
        <ConfBadge value={crop.species.confidence} label="Species" />
      </View>

      {/* Images */}
      {(crop.crop_url ||
        crop.species.gradcam_url ||
        crop.disease.gradcam_url) && (
        <View style={s.visualSection}>
          <Text style={s.visualSectionTitle}>VISUAL ANALYSIS</Text>
          <View style={s.imagesGrid}>
            {crop.crop_url && (
              <CropImageBox
                uri={crop.crop_url}
                label="Detection Crop"
                onPress={() => setViewerUri(crop.crop_url!)}
              />
            )}
            {crop.species.gradcam_url && (
              <CropImageBox
                uri={crop.species.gradcam_url}
                label="Species GradCAM"
                onPress={() => setViewerUri(crop.species.gradcam_url!)}
              />
            )}
            {crop.disease.gradcam_url && (
              <CropImageBox
                uri={crop.disease.gradcam_url}
                label="Disease GradCAM"
                onPress={() => setViewerUri(crop.disease.gradcam_url!)}
              />
            )}
          </View>
        </View>
      )}

      {/* Bounding box + Crop ID */}
      <View style={s.metaChipsRow}>
        <View style={s.metaChip}>
          <Text style={s.metaChipKey}>BBOX</Text>
          <Text style={s.metaChipVal}>[{crop.bbox.join(", ")}]</Text>
        </View>
        <View style={s.metaChip}>
          <Text style={s.metaChipKey}>CROP ID</Text>
          <Text style={s.metaChipVal} numberOfLines={1}>
            {cropKey}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Offline Detailed View ────────────────────────────────────────────────────

function OfflineDetailPage() {
  const data = getAnalysisData();
  if (!data || data.mode !== "offline") return null;
  const { offlineResults, processingTime, imageUri, location } = data;

  const processSecs = (processingTime / 1000).toFixed(1);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* ── Report Summary Strip ── */}
      <View style={s.statsStrip}>
        <StatPill
          iconName="hardware-chip-outline"
          value="On-Device"
          label="Mode"
          accentColor={COLORS.primaryLight}
        />
        <View style={s.statsStripDivider} />
        <StatPill
          iconName="timer-outline"
          value={`${processSecs}s`}
          label="Processing"
          accentColor={COLORS.accentLight}
        />
        <View style={s.statsStripDivider} />
        <StatPill
          iconName="fish-outline"
          value={`${offlineResults.length}`}
          label="Detected"
          accentColor={COLORS.secondaryLight}
        />
      </View>

      {/* ── Location chip ── */}
      {location && (
        <View style={s.locationChip}>
          <Ionicons
            name="location-outline"
            size={12}
            color={COLORS.textMuted}
          />
          <Text style={s.locationChipText}>
            {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
          </Text>
        </View>
      )}

      {/* ── Source Image ── */}
      {imageUri && (
        <>
          <SectionDivider title="Source Image" />
          <View style={s.sourceImageCard}>
            <Image
              source={{ uri: imageUri }}
              style={s.sourceImg}
              resizeMode="cover"
            />
            <View style={s.sourceImageFooter}>
              <Ionicons
                name="camera-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text style={s.sourceImageFooterText}>Analysis Source</Text>
            </View>
          </View>
        </>
      )}

      {/* ── Per-Fish Results ── */}
      <SectionDivider title={`Fish Details (${offlineResults.length})`} />

      {offlineResults.map((det, idx) => (
        <OfflineFishDetail
          key={idx}
          det={det}
          index={idx}
          imageUri={imageUri}
        />
      ))}
    </ScrollView>
  );
}

function OfflineFishDetail({
  det,
  index,
  imageUri,
}: {
  det: OfflineDetectionResult;
  index: number;
  imageUri: string;
}) {
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [estimatedWeightG, setEstimatedWeightG] = useState<number | null>(null);

  const storageKey = `weight_estimate::${imageUri}::${index}`;

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val !== null) setEstimatedWeightG(parseFloat(val));
    });
  }, [storageKey]);

  const handleConfirmWeight = async (wg: number) => {
    setEstimatedWeightG(wg);
    setWeightModalVisible(false);
    await AsyncStorage.setItem(storageKey, String(wg));
    await SyncService.queueChange("weight_estimate", {
      imageUri,
      fishIndex: index,
      species: det.species,
      weightG: wg,
      timestamp: new Date().toISOString(),
    });
  };

  const { locale } = useLanguage();
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const qualColor =
    det.qualityGrade === "Premium"
      ? COLORS.success
      : det.qualityGrade === "Standard"
        ? COLORS.warning
        : COLORS.error;

  const healthColor =
    det.disease === "Healthy Fish" ? COLORS.success : COLORS.warning;

  return (
    <View style={[s.fishCard, { borderLeftColor: qualColor }]}>
      <WeightEstimateModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onConfirm={handleConfirmWeight}
        species={det.species}
        fishIndex={index}
      />
      {viewerUri && (
        <FullscreenImageViewer
          uri={viewerUri}
          onClose={() => setViewerUri(null)}
        />
      )}

      {/* ── Card Header ── */}
      <View style={[s.fishCardHeader, { borderBottomColor: qualColor + "30" }]}>
        <View
          style={[
            s.fishNumberPill,
            {
              backgroundColor: qualColor + "20",
              borderColor: qualColor + "55",
            },
          ]}
        >
          <Text style={[s.fishNumberText, { color: qualColor }]}>
            FISH #{index + 1}
          </Text>
        </View>
        <ConfBadge value={det.speciesConfidence} label="Species" />
      </View>

      {/* ── Species Name ── */}
      <View style={s.speciesSection}>
        <Text style={s.speciesMainName}>
          {translateFishName(det.species, locale)}
        </Text>
        <Text style={s.speciesScientific}>{det.species}</Text>
      </View>

      {/* ── Health & Disease Banner ── */}
      <View
        style={[
          s.healthBanner,
          {
            backgroundColor: healthColor + "14",
            borderColor: healthColor + "35",
          },
        ]}
      >
        <Ionicons
          name={
            det.disease === "Healthy Fish"
              ? "checkmark-circle-outline"
              : "warning-outline"
          }
          size={20}
          color={healthColor}
        />
        <View style={s.healthBannerBody}>
          <Text style={s.healthBannerLabel}>HEALTH STATUS</Text>
          <Text style={[s.healthBannerValue, { color: healthColor }]}>
            {translateDiseaseName(det.disease, locale)}
          </Text>
        </View>
        <ConfBadge value={det.diseaseConfidence} label="Conf" />
      </View>

      {/* ── Weight Estimation ── */}
      {estimatedWeightG !== null ? (
        <View
          style={[
            s.weightResultCard,
            { borderColor: COLORS.secondaryLight + "45" },
          ]}
        >
          <View style={s.weightResultCardHeader}>
            <View style={s.weightResultTitleRow}>
              <Ionicons
                name="scale-outline"
                size={13}
                color={COLORS.textMuted}
              />
              <Text style={s.weightResultCardTitle}>Estimated Weight</Text>
            </View>
            <TouchableOpacity
              onPress={() => setWeightModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={s.weightRecalcBtn}>Recalculate</Text>
            </TouchableOpacity>
          </View>
          <View style={s.weightResultCardBody}>
            <Text style={s.weightGrams}>
              {estimatedWeightG.toFixed(1)}
              <Text style={s.weightUnit}> g</Text>
            </Text>
            <Text style={s.weightKg}>
              ≈ {(estimatedWeightG / 1000).toFixed(3)} kg
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={s.weightCta}
          onPress={() => setWeightModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={s.weightCtaLeft}>
            <Ionicons
              name="scale-outline"
              size={22}
              color={COLORS.primaryLight}
            />
            <View>
              <Text style={s.weightCtaTitle}>Estimate Weight</Text>
              <Text style={s.weightCtaSub}>On-Device AI Model</Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.primaryLight}
          />
        </TouchableOpacity>
      )}

      {/* ── Visual Analysis ── */}
      {(det.cropUri || det.gradcamUri) && (
        <View style={s.visualSection}>
          <Text style={s.visualSectionTitle}>VISUAL ANALYSIS</Text>
          <View style={s.imagesGrid}>
            {det.cropUri && (
              <CropImageBox
                uri={det.cropUri}
                label="Detection Crop"
                onPress={() => setViewerUri(det.cropUri!)}
              />
            )}
            {det.gradcamUri && (
              <CropImageBox
                uri={det.gradcamUri}
                label="GradCAM Heatmap"
                onPress={() => setViewerUri(det.gradcamUri!)}
              />
            )}
          </View>
        </View>
      )}

      {/* ── Bounding Box ── */}
      <View style={s.metaChipsRow}>
        <View style={s.metaChip}>
          <Text style={s.metaChipKey}>BOUNDING BOX (px)</Text>
          <Text style={s.metaChipVal}>[{det.bbox.join(", ")}]</Text>
        </View>
      </View>

      {/* ── Error ── */}
      {det.error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{det.error}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Shared Image Box ─────────────────────────────────────────────────────────

function CropImageBox({
  uri,
  label,
  onPress,
}: {
  uri: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.imgBox} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri }} style={s.imgBoxImg} resizeMode="cover" />
      <View style={s.lightboxIconOverlay}>
        <Ionicons name="expand-outline" size={13} color={COLORS.textPrimary} />
      </View>
      <View style={s.imgBoxFooter}>
        <Text style={s.imgBoxLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DetailedAnalysisScreen() {
  const data = getAnalysisData();

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen
        options={{
          title: "Detailed Analysis Report",
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.bgDark },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: { fontWeight: FONTS.weights.bold },
        }}
      />

      {!data ? (
        <View style={s.emptyPage}>
          <Text style={s.emptyPageText}>No analysis data available.</Text>
          <Button
            label="Go Back"
            onPress={() => router.back()}
            variant="outline"
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      ) : data.mode === "online" ? (
        <OnlineDetailPage />
      ) : (
        <OfflineDetailPage />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Shell ──
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 96,
  },

  emptyPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING["2xl"],
  },
  emptyPageText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    textAlign: "center",
  },

  // ── Section divider ──
  sectionDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  sectionDividerText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSubtle,
    letterSpacing: 1.4,
  },

  // ── Stats strip ──
  statsStrip: {
    flexDirection: "row",
    backgroundColor: COLORS.bgCard,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  statPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderTopWidth: 3,
  },
  statPillValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.extrabold,
  },
  statPillLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statsStripDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },

  // ── Location chip ──
  locationChip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  locationChipText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },

  // ── Source image card ──
  sourceImageCard: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgCard,
  },
  sourceImg: {
    width: "100%",
    height: 210,
    backgroundColor: COLORS.bgCard,
  },
  sourceImageFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.bgDark + "E5",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  sourceImageFooterText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // ── Fish card ──
  fishCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  fishCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: CARD_PADDING,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgDark,
    borderBottomWidth: 1,
  },
  fishNumberPill: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  fishNumberText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 1.2,
  },

  // ── Species ──
  speciesSection: {
    paddingHorizontal: CARD_PADDING,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  speciesMainName: {
    fontSize: FONTS.sizes["2xl"],
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.textPrimary,
    lineHeight: 32,
  },
  speciesScientific: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSubtle,
    fontStyle: "italic",
    marginTop: 2,
  },

  // ── Health banner ──
  healthBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: CARD_PADDING,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  healthBannerBody: { flex: 1 },
  healthBannerLabel: {
    fontSize: 10,
    color: COLORS.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  healthBannerValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    marginTop: 1,
  },

  // ── Weight CTA ──
  weightCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: CARD_PADDING,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.primary + "28",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight + "45",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  weightCtaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  weightCtaTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  weightCtaSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  // ── Weight result card ──
  weightResultCard: {
    marginHorizontal: CARD_PADDING,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.secondary + "1E",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  weightResultCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary + "28",
  },
  weightResultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  weightResultCardTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  weightRecalcBtn: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.secondaryLight,
    fontWeight: FONTS.weights.medium,
  },
  weightResultCardBody: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  weightGrams: {
    fontSize: FONTS.sizes["2xl"],
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.secondaryLight,
  },
  weightUnit: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.secondaryLight,
  },
  weightKg: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // ── Visual analysis section ──
  visualSection: {
    marginHorizontal: CARD_PADDING,
    marginBottom: SPACING.sm,
  },
  visualSectionTitle: {
    fontSize: 10,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
    textTransform: "uppercase",
  },
  imagesGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  imgBox: {
    flex: 1,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgDark,
  },
  imgBoxImg: {
    width: "100%",
    aspectRatio: 1,
  },
  imgBoxFooter: {
    backgroundColor: COLORS.bgDark + "F0",
    paddingVertical: 4,
    paddingHorizontal: SPACING.xs,
  },
  imgBoxLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "center",
  },

  // ── Meta chips ──
  metaChipsRow: {
    marginHorizontal: CARD_PADDING,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    flexWrap: "wrap",
  },
  metaChipKey: {
    fontSize: 10,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metaChipVal: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontFamily: "monospace",
    flex: 1,
  },

  // ── Inline conf row ──
  inlineConfRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: CARD_PADDING,
    marginBottom: SPACING.sm,
  },
  inlineConfLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },

  // ── Conf badge ──
  confBadge: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignItems: "center",
    minWidth: 60,
  },
  confPct: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
  },
  confLabel: {
    fontSize: 9,
    marginTop: 1,
    letterSpacing: 0.5,
  },

  // ── Error ──
  errorBox: {
    backgroundColor: COLORS.error + "15",
    borderWidth: 1,
    borderColor: COLORS.error + "40",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginHorizontal: CARD_PADDING,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
  },

  // ── Online view helpers ──
  card: { marginBottom: SPACING.sm },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  infoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    flex: 1,
  },
  infoValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    flex: 2,
    textAlign: "right",
  },
  mono: {
    fontFamily: "monospace",
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },

  speciesDist: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  speciesDistTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  speciesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
  },
  speciesRowName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  speciesRowCount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },

  onlineImageWrapper: {
    marginBottom: SPACING.md,
  },
  onlineImageLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
  },
  yoloImg: {
    width: "100%",
    height: 200,
    borderRadius: CARD_RADIUS,
    backgroundColor: COLORS.bgCard,
  },

  // ── Tabs ──
  tabsRow: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  tabActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primaryLight + "22",
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.semibold,
  },

  // ── Lightbox ──
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxCloseBtn: {
    position: "absolute",
    top: 52,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.full,
    padding: SPACING.sm,
    zIndex: 10,
  },
  lightboxHint: {
    position: "absolute",
    bottom: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADIUS.full,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
  },
  lightboxHintText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },

  // ── Expand badge on tappable images ──
  imageExpandBadge: {
    position: "absolute",
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: RADIUS.sm,
    padding: 5,
  },
  lightboxIconOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: RADIUS.xs,
    padding: 3,
  },
});
