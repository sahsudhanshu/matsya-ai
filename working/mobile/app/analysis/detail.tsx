/**
 * Detailed Analysis Report
 * Shows full ML analysis data for both online (cloud) and offline (on-device) results.
 * Data is passed via the analysis-store module.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  
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
import { generateMockSupplement } from "../../lib/species-data";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const YOLO_CONFIDENCE_THRESHOLD = 0.3;

// ─── Design constants ─────────────────────────────────────────────────────────
const CARD_PADDING = SPACING.md;
const CARD_RADIUS = RADIUS.lg;

// ─── Step Pipeline Components ────────────────────────────────────────────────

function StepItem({
  title,
  subtitle,
  value,
  icon,
  color,
  isLast = false,
}: {
  title: string;
  subtitle?: string;
  value: string | React.ReactNode;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  isLast?: boolean;
}) {
  return (
    <View className="flex-row">
      <View className="items-center mr-3">
        <View 
          className="w-8 h-8 rounded-full items-center justify-center z-10"
          style={{ backgroundColor: color + "20", borderWidth: 1, borderColor: color + "40" }}
        >
          <Ionicons name={icon} size={16} color={color} />
        </View>
        {!isLast && <View className="w-[2px] flex-1 bg-[#334155] -my-1" />}
      </View>
      <View className="flex-1 pb-6">
        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-[10px] font-bold tracking-[1px] text-[#64748b] uppercase">{title}</Text>
            {subtitle && <Text className="text-[12px] font-medium text-[#94a3b8] mt-0.5">{subtitle}</Text>}
          </View>
          <View>{typeof value === "string" ? <Text className="text-[14px] font-bold text-[#f8fafc]">{value}</Text> : value}</View>
        </View>
      </View>
    </View>
  );
}

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
      className="min-w-[60px] items-center rounded-sm border px-2 py-1"
      style={{ backgroundColor: color + "1A", borderColor: color + "55" }}
    >
      <Text className="text-[12px] font-extrabold" style={{ color }}>{pct}%</Text>
      {label && (
        <Text className="mt-[1px] text-[9px] tracking-[0.5px]" style={{ color: color + "BB" }}>
          {label.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <View className="mb-2 mt-4 flex-row items-center gap-2">
      <View className="h-[1px] flex-1 bg-[#334155]" />
      <Text className="text-[10px] font-bold tracking-[1.4px] text-[#64748b]">{title.toUpperCase()}</Text>
      <View className="h-[1px] flex-1 bg-[#334155]" />
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
      <View className="flex-1 items-center justify-center bg-black">
        <Image
          source={{ uri }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          resizeMode="contain"
        />
        <TouchableOpacity
          className="absolute right-4 top-[52px] z-10 rounded-full bg-white/15 p-2"
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View className="absolute bottom-9 flex-row items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5">
          <Ionicons name="expand-outline" size={13} color={COLORS.textMuted} />
          <Text className="text-[10px] text-[#94a3b8]">Tap anywhere to close</Text>
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
    <View className="flex-row items-start justify-between border-b border-[#334155] py-1 gap-2">
      <Text className="flex-1 text-[12px] text-[#94a3b8]">{label}</Text>
      <Text className={`flex-2 text-right text-[12px] text-[#f8fafc] ${mono ? "font-mono text-[#e2e8f0]" : ""}`}>{value}</Text>
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
    <View className="flex-1 items-center border-t-[3px] px-1 py-4" style={{ borderTopColor: accentColor }}>
      <Ionicons
        name={iconName}
        size={20}
        color={accentColor}
        style={{ marginBottom: 4 }}
      />
      <Text className="text-[15px] font-extrabold" style={{ color: accentColor }}>{value}</Text>
      <Text className="mt-0.5 text-[10px] tracking-[0.8px] text-[#94a3b8] uppercase">{label}</Text>
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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 }}>
      {viewerUri && (
        <FullscreenImageViewer
          uri={viewerUri}
          onClose={() => setViewerUri(null)}
        />
      )}
      {/* ── Identity & Meta ── */}
      <SectionDivider title="Report Identity" />
      <Card className="mb-2 p-4">
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

      {/* ── Image-level tabs ── */}
      <SectionDivider title="Per-Image Analysis" />

      {totalImages > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        >
          {groupAnalysis.images.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              className={`rounded-full border px-4 py-1 ${activeTab === idx ? "border-[#3b82f6] bg-[#3b82f622]" : "border-[#334155] bg-[#1e293b]"}`}
              onPress={() => setActiveTab(idx)}
            >
              <Text className={`text-[12px] ${activeTab === idx ? "font-semibold text-[#3b82f6]" : "text-[#94a3b8]"}`}>
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

          let globalOffset = 0;
          for (let i = 0; i < activeTab; i++) {
            const prevImg = groupAnalysis.images[i];
            if (prevImg && prevImg.crops) {
              globalOffset += Object.values(prevImg.crops).filter(
                (c) => c.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD,
              ).length;
            }
          }

          return (
            <View>
              {img.error && (
                <View className="mb-4 rounded-md border border-[#ef444440] bg-[#ef444415] p-2 mx-4">
                  <Text className="text-[12px] text-[#ef4444]">{img.error}</Text>
                </View>
              )}

              {imageUris[activeTab] && (
                <View className="mb-4">
                  <Text className="mb-1 text-[10px] font-bold tracking-[1.2px] text-[#64748b]">SOURCE IMAGE</Text>
                  <TouchableOpacity
                    onPress={() => setViewerUri(imageUris[activeTab])}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: imageUris[activeTab] }}
                      className="h-[210px] w-full bg-[#1e293b]"
                      resizeMode="contain"
                    />
                    <View className="absolute right-1 top-1 rounded-sm bg-black/55 p-1">
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
                <View className="mb-4">
                  <Text className="mb-1 text-[10px] font-bold tracking-[1.2px] text-[#64748b]">YOLO DETECTION OUTPUT</Text>
                  <TouchableOpacity
                    onPress={() => setViewerUri(img.yolo_image_url as string)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: img.yolo_image_url }}
                      className="h-[200px] w-full rounded-[16px] bg-[#1e293b]"
                      resizeMode="contain"
                    />
                    <View className="absolute right-1 top-1 rounded-sm bg-black/55 p-1">
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
                <Card className="mb-2 p-8">
                  <Text className="text-center text-[12px] text-[#94a3b8]">
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
                    globalIndex={globalOffset + ci}
                    imageUri={imageUris[activeTab]}
                    groupId={groupId}
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
          <View key={species} className="flex-row justify-between py-1">
            <Text className="flex-1 text-[12px] text-[#e2e8f0]">
              {translateFishName(species, locale)}
            </Text>
            <Text className="text-[12px] font-bold text-[#f8fafc]">{count}</Text>
          </View>
        ))}
    </>
  );
}

function OnlineCropDetail({
  cropKey,
  crop,
  index,
  globalIndex,
  imageUri,
  groupId,
}: {
  cropKey: string;
  crop: MLCropResult;
  index: number;
  globalIndex: number;
  imageUri: string;
  groupId?: string;
}) {
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [estimatedWeightG, setEstimatedWeightG] = useState<number | null>(null);

  // Use globalIndex for the storage key to avoid collisions if multiple images have same URI
  // (though imageUris usually differ, it's safer).
  const storageKey = `weight_estimate::${groupId || imageUri}::${globalIndex}`;

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
      groupId,
      imageUri,
      fishIndex: globalIndex,
      species: crop.species.label,
      weightG: wg,
      timestamp: new Date().toISOString(),
    });
  };

  const { locale } = useLanguage();
  const diseaseColor =
    crop.disease.label === "Healthy Fish" ? COLORS.success : COLORS.warning;
  const accentColor = COLORS.primaryLight;
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  return (
    <View className="mb-4 overflow-hidden rounded-[20px] border border-[#334155] bg-[#1e293b]">
      <WeightEstimateModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onConfirm={handleConfirmWeight}
        species={crop.species.label}
        fishIndex={globalIndex}
      />
      {viewerUri && (
        <FullscreenImageViewer
          uri={viewerUri}
          onClose={() => setViewerUri(null)}
        />
      )}
      {/* Header */}
      <View className="flex-row items-center justify-between border-b bg-[#0f172a] px-4 py-3" style={{ borderBottomColor: "#334155" }}>
        <View className="flex-row items-center gap-2">
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: accentColor + "20" }}
          >
            <Text className="text-[12px] font-extrabold tracking-[1px]" style={{ color: accentColor }}>
              FISH #{index + 1}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="cloud-done-outline" size={16} color="#64748b" />
          <Text className="text-[10px] font-bold text-[#64748b]">CLOUD ANALYSIS</Text>
        </View>
      </View>

      {/* Step Pipeline */}
      <View className="px-5 pt-6">
        <StepItem
          title="Detection"
          subtitle="YOLOv8 Vision Model"
          icon="scan-outline"
          color={COLORS.primaryLight}
          value={<ConfBadge value={crop.yolo_confidence} />}
        />

        <StepItem
          title="Species Identification"
          subtitle={crop.species.label}
          icon="fish-outline"
          color={COLORS.secondaryLight}
          value={
            <View className="items-end">
              <Text className="text-[16px] font-bold text-[#f8fafc]">{translateFishName(crop.species.label, locale)}</Text>
              <ConfBadge value={crop.species.confidence} />
            </View>
          }
        />

        <StepItem
          title="Health Assessment"
          subtitle={translateDiseaseName(crop.disease.label, locale)}
          icon={crop.disease.label === "Healthy Fish" ? "checkmark-circle-outline" : "warning-outline"}
          color={diseaseColor}
          value={<ConfBadge value={crop.disease.confidence} />}
        />

        <StepItem
          title="Weight Estimation"
          subtitle={estimatedWeightG !== null ? "AI Calculated" : "Awaiting Input"}
          icon="scale-outline"
          color={COLORS.accentLight}
          isLast
          value={
            estimatedWeightG !== null ? (
              <TouchableOpacity onPress={() => setWeightModalVisible(true)} className="items-end">
                <Text className="text-[16px] font-bold text-[#10b981]">{estimatedWeightG.toFixed(1)} g</Text>
                <Text className="text-[10px] text-[#94a3b8]">≈ {(estimatedWeightG / 1000).toFixed(2)} kg</Text>
              </TouchableOpacity>
            ) : (
              <Button
                label="Estimate"
                onPress={() => setWeightModalVisible(true)}
                variant="primary"
                size="sm"
                className="py-1 px-2"
              />
            )
          }
        />
      </View>

      {/* Images */}
      {(crop.crop_url ||
        crop.species.gradcam_url ||
        crop.disease.gradcam_url) && (
        <View className="mx-4 mb-4 mt-2">
          <SectionDivider title="Visual Evidence" />
          <View className="flex-row gap-2 mt-2">
            {crop.crop_url && (
              <CropImageBox
                uri={crop.crop_url}
                label="Detection"
                onPress={() => setViewerUri(crop.crop_url!)}
              />
            )}
            {crop.species.gradcam_url && (
              <CropImageBox
                uri={crop.species.gradcam_url}
                label="Species"
                onPress={() => setViewerUri(crop.species.gradcam_url!)}
              />
            )}
            {crop.disease.gradcam_url && (
              <CropImageBox
                uri={crop.disease.gradcam_url}
                label="Health"
                onPress={() => setViewerUri(crop.disease.gradcam_url!)}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Offline Detailed View ────────────────────────────────────────────────────

function OfflineDetailPage() {
  const data = getAnalysisData();
  if (!data || data.mode !== "offline") return null;
  const { offlineResults, processingTime, imageUri, location, localRecordId } = data;

  const processSecs = (processingTime / 1000).toFixed(1);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 }}>
      {/* ── Report Summary Strip ── */}
      <View className="mb-2 mt-1 flex-row overflow-hidden rounded-[16px] border border-[#334155] bg-[#1e293b]">
        <StatPill
          iconName="hardware-chip-outline"
          value="On-Device"
          label="Mode"
          accentColor={COLORS.primaryLight}
        />
        <View className="my-2 w-[1px] bg-[#334155]" />
        <StatPill
          iconName="timer-outline"
          value={`${processSecs}s`}
          label="Processing"
          accentColor={COLORS.accentLight}
        />
        <View className="my-2 w-[1px] bg-[#334155]" />
        <StatPill
          iconName="fish-outline"
          value={`${offlineResults.length}`}
          label="Detected"
          accentColor={COLORS.secondaryLight}
        />
      </View>

      {/* ── Location chip ── */}
      {location && (
        <View className="mb-1 flex-row items-center gap-1.5 self-center rounded-full border border-[#334155] bg-[#1e293b] px-4 py-1.5">
          <Ionicons
            name="location-outline"
            size={12}
            color={COLORS.textMuted}
          />
          <Text className="text-[10px] tracking-[0.4px] text-[#94a3b8]">
            {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
          </Text>
        </View>
      )}

      {/* ── Source Image ── */}
      {imageUri && (
        <>
          <SectionDivider title="Source Image" />
          <View className="mb-1 overflow-hidden rounded-[16px] border border-[#334155] bg-[#1e293b]">
            <Image
              source={{ uri: imageUri }}
              className="h-[210px] w-full bg-[#1e293b]"
              resizeMode="cover"
            />
            <View className="flex-row items-center gap-1.5 bg-[#0f172ae5] px-4 py-1">
              <Ionicons
                name="camera-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text className="text-[10px] tracking-[0.5px] text-[#94a3b8]">Analysis Source</Text>
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
          localRecordId={localRecordId}
        />
      ))}
    </ScrollView>
  );
}

function OfflineFishDetail({
  det,
  index,
  imageUri,
  localRecordId,
}: {
  det: OfflineDetectionResult;
  index: number;
  imageUri: string;
  localRecordId?: string;
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
    
    if (localRecordId) {
      const { updateLocalDetectionWeight } = await import("../../lib/local-history");
      await updateLocalDetectionWeight(localRecordId, index, wg);
    } else {
      await SyncService.queueChange("weight_estimate", {
        imageUri,
        fishIndex: index,
        species: det.species,
        weightG: wg,
        timestamp: new Date().toISOString(),
      });
    }
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
    <View className="mb-4 overflow-hidden rounded-[20px] border border-[#334155] bg-[#1e293b]">
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
      <View className="flex-row items-center justify-between border-b bg-[#0f172a] px-4 py-3" style={{ borderBottomColor: "#334155" }}>
        <View className="flex-row items-center gap-2">
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: COLORS.secondaryLight + "20" }}
          >
            <Text className="text-[12px] font-extrabold tracking-[1px]" style={{ color: COLORS.secondaryLight }}>
              FISH #{index + 1}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="phone-portrait-outline" size={16} color="#64748b" />
          <Text className="text-[10px] font-bold text-[#64748b]">OFFLINE SCAN</Text>
        </View>
      </View>

      {/* Step Pipeline */}
      <View className="px-5 pt-6">
        <StepItem
          title="Detection"
          subtitle="On-Device YOLO"
          icon="scan-outline"
          color={COLORS.primaryLight}
          value={<ConfBadge value={det.speciesConfidence} />}
        />

        <StepItem
          title="Species Identification"
          subtitle={det.species}
          icon="fish-outline"
          color={COLORS.secondaryLight}
          value={
            <View className="items-end">
              <Text className="text-[16px] font-bold text-[#f8fafc]">{translateFishName(det.species, locale)}</Text>
              <ConfBadge value={det.speciesConfidence} />
            </View>
          }
        />

        <StepItem
          title="Health Assessment"
          subtitle={translateDiseaseName(det.disease, locale)}
          icon={det.disease === "Healthy Fish" ? "checkmark-circle-outline" : "warning-outline"}
          color={healthColor}
          value={<ConfBadge value={det.diseaseConfidence} />}
        />

        <StepItem
          title="Weight Estimation"
          subtitle={estimatedWeightG !== null ? "Manual Entry" : (det.weightG > 0 ? "AI Calculated" : "Awaiting Input")}
          icon="scale-outline"
          color={COLORS.accentLight}
          isLast
          value={
            estimatedWeightG !== null || det.weightG > 0 ? (
              <TouchableOpacity onPress={() => setWeightModalVisible(true)} className="items-end">
                <Text className="text-[16px] font-bold text-[#10b981]">
                  {estimatedWeightG !== null ? estimatedWeightG.toFixed(1) : det.weightG.toFixed(1)} g
                </Text>
                <Text className="text-[10px] text-[#94a3b8]">
                  ≈ {((estimatedWeightG !== null ? estimatedWeightG : det.weightG) / 1000).toFixed(2)} kg
                </Text>
              </TouchableOpacity>
            ) : (
              <Button
                label="Enter Weight"
                onPress={() => setWeightModalVisible(true)}
                variant="primary"
                size="sm"
                className="py-1 px-2"
              />
            )
          }
        />
      </View>

      {/* ── Visual Analysis ── */}
      {(det.cropUri || det.gradcamUri) && (
        <View className="mx-4 mb-4 mt-2">
          <SectionDivider title="Visual Evidence" />
          <View className="flex-row gap-2 mt-2">
            {det.cropUri && (
              <CropImageBox
                uri={det.cropUri}
                label="Detection"
                onPress={() => setViewerUri(det.cropUri!)}
              />
            )}
            {det.gradcamUri && (
              <CropImageBox
                uri={det.gradcamUri}
                label="GradCAM"
                onPress={() => setViewerUri(det.gradcamUri!)}
              />
            )}
          </View>
        </View>
      )}

      {/* ── Error ── */}
      {det.error && (
        <View className="mb-2 mx-4 rounded-md border border-[#ef444440] bg-[#ef444415] p-2">
          <Text className="text-[12px] text-[#ef4444]">{det.error}</Text>
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
    <TouchableOpacity className="flex-1 overflow-hidden rounded-[12px] border border-[#334155] bg-[#0f172a]" onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri }} className="w-full aspect-square" resizeMode="cover" />
      <View className="absolute right-1.5 top-1.5 rounded-sm bg-black/50 p-[3px]">
        <Ionicons name="expand-outline" size={13} color={COLORS.textPrimary} />
      </View>
      <View className="bg-[#0f172af0] px-1 py-1">
        <Text className="text-center text-[10px] text-[#94a3b8]">{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DetailedAnalysisScreen() {
  const data = getAnalysisData();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
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
        <View className="flex-1 items-center justify-center p-[48px]">
          <Text className="text-center text-[12px] text-[#94a3b8]">No analysis data available.</Text>
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
