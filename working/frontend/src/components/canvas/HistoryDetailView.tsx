/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  Download,
  Bug,
  Scale,
  TrendingUp,
  MapPin,
  Bot,
  ChevronLeft,
  ChevronRight,
  Eye,
  ChevronDown,
  ChevronUp,
  Images,
  Sparkles,
  Search,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getGroupDetails,
  estimateFishWeight,
  saveWeightEstimate,
  type GroupRecord,
  type FishWeightEstimate,
} from "@/lib/api-client";
import { resolveMLUrl } from "@/lib/constants";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Dynamic imports for map components
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

export default function HistoryDetailView({
  groupId,
  onBack,
}: {
  groupId: string;
  onBack: () => void;
}) {
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);

  // Split view state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [expandedCrops, setExpandedCrops] = useState<Set<string>>(
    new Set(["yolo_overview"]),
  );

  // Weight estimation state
  const [weightFormOpen, setWeightFormOpen] = useState<Record<string, boolean>>(
    {},
  );
  const [weightInputs, setWeightInputs] = useState<
    Record<
      string,
      { length1: string; length3: string; height: string; width: string }
    >
  >({});
  const [weightLoading, setWeightLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [weightResults, setWeightResults] = useState<
    Record<string, FishWeightEstimate>
  >({});
  const [weightErrors, setWeightErrors] = useState<Record<string, string>>({});

  const YOLO_CONFIDENCE_THRESHOLD = 0.3;

  useEffect(() => {
    const loadGroupDetails = async () => {
      try {
        setIsLoading(true);
        const data = await getGroupDetails(groupId);
        setGroup(data);

        // Calculate analysis time if available
        if (data.createdAt && data.analysisResult?.processedAt) {
          const start = new Date(data.createdAt).getTime();
          const end = new Date(data.analysisResult.processedAt).getTime();
          setAnalysisTime(Math.round((end - start) / 1000));
        }

        // Load any previously saved weight estimates from the group record
        const saved = (data as any).weightEstimates;
        if (saved && typeof saved === "object") {
          const loaded: Record<string, FishWeightEstimate> = {};
          for (const [fishKey, val] of Object.entries(saved)) {
            if (
              val &&
              typeof val === "object" &&
              (val as any).estimated_weight_grams
            ) {
              const v = val as any;
              loaded[fishKey] = {
                species: v.species || "",
                estimated_weight_grams: v.estimated_weight_grams,
                estimated_weight_range: v.estimated_weight_range || {
                  min_grams: 0,
                  max_grams: 0,
                },
                ml_predicted_weight_grams: v.ml_predicted_weight_grams ?? null,
                formula_calculated_weight_grams:
                  v.formula_calculated_weight_grams ?? 0,
                market_price_per_kg: v.market_price_per_kg || {
                  min_inr: 0,
                  max_inr: 0,
                  market_reference: "",
                },
                estimated_fish_value: v.estimated_fish_value || {
                  min_inr: 0,
                  max_inr: 0,
                },
                notes: v.notes || "",
              };
            }
          }
          setWeightResults(loaded);
        }
      } catch (err) {
        console.error("Failed to load group details", err);
        toast.error("Failed to load group details");
      } finally {
        setIsLoading(false);
      }
    };
    loadGroupDetails();
  }, [groupId]);

  const handleWeightEstimate = useCallback(
    async (cropKey: string, fishIndex: number, species: string) => {
      const inputs = weightInputs[cropKey];
      if (
        !inputs ||
        !inputs.length1 ||
        !inputs.length3 ||
        !inputs.height ||
        !inputs.width
      ) {
        setWeightErrors((prev) => ({
          ...prev,
          [cropKey]: "Please fill all measurement fields",
        }));
        return;
      }
      setWeightLoading((prev) => ({ ...prev, [cropKey]: true }));
      setWeightErrors((prev) => ({ ...prev, [cropKey]: "" }));
      try {
        const result = await estimateFishWeight({
          species,
          length1: parseFloat(inputs.length1),
          length3: parseFloat(inputs.length3),
          height: parseFloat(inputs.height),
          width: parseFloat(inputs.width),
        });

        // Store the result keyed by fish_<index> to match the backend format
        const fishKey = `fish_${fishIndex}`;
        setWeightResults((prev) => ({ ...prev, [fishKey]: result }));
        setWeightFormOpen((prev) => ({ ...prev, [cropKey]: false }));

        // Save to database
        try {
          await saveWeightEstimate({
            groupId,
            imageIndex: selectedImageIndex,
            fishIndex,
            species,
            weightG: result.estimated_weight_grams,
            fullEstimate: result,
          });
          toast.success("Weight estimate saved");
        } catch (saveErr) {
          console.error("Failed to save weight estimate", saveErr);
          // Don't fail the UX - the estimate is still shown
        }
      } catch (err) {
        setWeightErrors((prev) => ({
          ...prev,
          [cropKey]: err instanceof Error ? err.message : "Estimation failed",
        }));
      } finally {
        setWeightLoading((prev) => ({ ...prev, [cropKey]: false }));
      }
    },
    [weightInputs, groupId, selectedImageIndex],
  );

  const toggleCropExpand = (key: string) => {
    setExpandedCrops((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportToPdf = async () => {
    if (!group?.analysisResult) return;
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let cursorY = 20;

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("MatsyaAI - Group Analysis Report", 14, cursorY);

      cursorY += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, cursorY);
      cursorY += 5;
      doc.text(`Group ID: ${groupId}`, 14, cursorY);
      cursorY += 5;
      doc.text(
        `Analysis Date: ${new Date(group.createdAt).toLocaleString()}`,
        14,
        cursorY,
      );

      if (group.latitude && group.longitude) {
        cursorY += 5;
        doc.text(
          `Location: ${Number(group.latitude).toFixed(6)}, ${Number(group.longitude).toFixed(6)} (Ocean)`,
          14,
          cursorY,
        );
      }

      cursorY += 12;
      doc.setDrawColor(200);
      doc.line(14, cursorY, pageWidth - 14, cursorY);
      cursorY += 10;

      const stats = group.analysisResult.aggregateStats;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("Aggregate Statistics", 14, cursorY);
      cursorY += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Fish Detected: ${stats.totalFishCount}`, 18, cursorY);
      cursorY += 6;
      doc.text(
        `Total Estimated Weight: ${stats.totalEstimatedWeight.toFixed(2)} kg`,
        18,
        cursorY,
      );
      cursorY += 6;
      doc.text(
        `Total Estimated Value: ₹${stats.totalEstimatedValue.toLocaleString()}`,
        18,
        cursorY,
      );
      cursorY += 10;

      const allCrops = group.analysisResult.images.flatMap((img, imgIdx) =>
        Object.entries(img.crops).map(([key, crop]) => ({
          key: `${imgIdx}_${key}`,
          imageIndex: imgIdx,
          crop,
        })),
      );

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Individual Fish Detections (${allCrops.length} total)`,
        14,
        cursorY,
      );
      cursorY += 8;

      for (let i = 0; i < allCrops.length; i++) {
        const { imageIndex, crop } = allCrops[i];
        const fishKey = `fish_${i}`;
        const saved = weightResults[fishKey];

        if (cursorY > pageHeight - 40) {
          doc.addPage();
          cursorY = 20;
        }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Fish #${i + 1} (Image ${imageIndex + 1}) - ${crop.species.label}`,
          18,
          cursorY,
        );
        cursorY += 6;
        doc.setFont("helvetica", "normal");
        doc.text(
          `Disease: ${crop.disease.label} (${(crop.disease.confidence * 100).toFixed(1)}%)`,
          22,
          cursorY,
        );
        cursorY += 5;
        if (saved) {
          doc.text(
            `Weight: ${(saved.estimated_weight_grams / 1000).toFixed(2)} kg  |  Value: ₹${saved.estimated_fish_value.min_inr}–${saved.estimated_fish_value.max_inr}`,
            22,
            cursorY,
          );
        } else {
          doc.text(`Weight: Not estimated`, 22, cursorY);
        }
        cursorY += 8;
      }

      doc.save(`matsyaai-group-${groupId.slice(0, 8)}-${Date.now()}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  const navigateImage = (direction: "prev" | "next") => {
    if (!group?.analysisResult) return;
    const maxIdx = group.analysisResult.images.length - 1;
    if (direction === "prev")
      setSelectedImageIndex(Math.max(0, selectedImageIndex - 1));
    else setSelectedImageIndex(Math.min(maxIdx, selectedImageIndex + 1));
  };

  // Derived state for the currently selected image
  const currentImages = group?.analysisResult?.images ?? [];
  const currentImageResult = currentImages[selectedImageIndex] || null;

  const cropEntries = useMemo(() => {
    if (!currentImageResult?.crops) return [];
    return Object.entries(currentImageResult.crops as Record<string, any>)
      .filter(([, crop]) => crop.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD)
      .sort((a, b) => b[1].species.confidence - a[1].species.confidence);
  }, [currentImageResult]);

  // Calculate the global fish index for a crop entry given its position in the current image
  const getGlobalFishIndex = useCallback(
    (localIdx: number): number => {
      let offset = 0;
      for (let i = 0; i < selectedImageIndex; i++) {
        const img = currentImages[i];
        if (img?.crops) {
          offset += Object.entries(img.crops as Record<string, any>).filter(
            ([, c]) => c.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD,
          ).length;
        }
      }
      return offset + localIdx;
    },
    [selectedImageIndex, currentImages],
  );

  if (isLoading) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Loading analysis history...
        </p>
      </div>
    );
  }

  if (!group || !group.analysisResult) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center text-center">
        <p className="text-muted-foreground mb-4">
          Analysis not found or pending
        </p>
        <Button onClick={onBack} className="rounded-xl">
          Back to History
        </Button>
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col animate-fade-in-up"
      style={{ animationDuration: "0.4s" }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-xl mr-1 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 hidden sm:flex">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold leading-tight truncate">
              Past Analysis
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground/80 truncate">
              {new Date(group.createdAt).toLocaleString()} ·{" "}
              {currentImages.length}{" "}
              {currentImages.length === 1 ? "image" : "images"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPdf}
            className="h-8 rounded-xl border-border/20 text-xs font-medium hover:bg-muted/20"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        {/* ── LEFT: Image carousel + Analysis Details ── */}
        <div className="flex flex-col min-h-0 gap-3 w-full">
          {/* Current Image Viewer */}
          <div className="relative rounded-2xl overflow-hidden border border-border/15 bg-card/30 backdrop-blur-sm flex-shrink-0 animate-slide-in-left">
            {group.presignedViewUrls?.[selectedImageIndex] ||
            currentImageResult?.yolo_image_url ? (
              <img
                src={
                  group.presignedViewUrls?.[selectedImageIndex] ||
                  resolveMLUrl(currentImageResult!.yolo_image_url)
                }
                alt={`Image ${selectedImageIndex + 1}`}
                className="w-full h-auto max-h-[250px] sm:max-h-[300px] object-contain bg-black/10 transition-opacity duration-300"
              />
            ) : (
              <div className="w-full h-[250px] flex items-center justify-center bg-black/5 text-muted-foreground text-sm">
                Image Preview Unavailable
              </div>
            )}

            {/* Navigation arrows */}
            {currentImages.length > 1 && (
              <>
                <button
                  onClick={() => navigateImage("prev")}
                  disabled={selectedImageIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateImage("next")}
                  disabled={selectedImageIndex >= currentImages.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {currentImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        selectedImageIndex === idx
                          ? "w-6 bg-white"
                          : "w-1.5 bg-white/40 hover:bg-white/60",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Location overlay */}
            {group.latitude && group.longitude && (
              <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[9px] font-mono">
                <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                {Number(group.latitude).toFixed(4)}°N, {Number(group.longitude).toFixed(4)}°E
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {currentImages.length > 1 && (
            <div className="flex gap-1.5 px-1 overflow-x-auto scrollbar-none shrink-0 animate-fade-in-up">
              {currentImages.map((img, idx) => {
                const imgUrl =
                  group.presignedViewUrls?.[idx] || img.yolo_image_url;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={cn(
                      "shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-300 bg-black/5",
                      selectedImageIndex === idx
                        ? "border-primary ring-1 ring-primary/20 scale-[1.02]"
                        : "border-transparent opacity-50 hover:opacity-90",
                    )}
                  >
                    {imgUrl ? (
                      <img
                        src={
                          imgUrl === img.yolo_image_url
                            ? resolveMLUrl(imgUrl)
                            : imgUrl
                        }
                        alt=""
                        className="w-12 h-12 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted/20 flex items-center justify-center">
                        <Images className="w-4 h-4 opacity-30" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable details area */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 animate-fade-in-up pr-1">
            {/* Aggregate Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold text-primary">
                    {group.analysisResult.aggregateStats.totalFishCount}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">
                    Total Fish
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">
                    {
                      Object.keys(
                        group.analysisResult.aggregateStats.speciesDistribution,
                      ).length
                    }
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">
                    Species
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">
                    {group.analysisResult.aggregateStats.totalEstimatedWeight.toFixed(
                      1,
                    )}{" "}
                    kg
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">
                    Total Weight
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">
                    ₹{group.analysisResult.aggregateStats.totalEstimatedValue}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">
                    Total Value
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Individual Fish Cards for Selected Image */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2 mb-2">
                <Search className="w-3.5 h-3.5" /> Detections for Image{" "}
                {selectedImageIndex + 1}
              </h3>

              {cropEntries.length > 0 ? (
                cropEntries.map(([key, crop], localIdx) => {
                  const globalIdx = getGlobalFishIndex(localIdx);
                  const fishKey = `fish_${globalIdx}`;
                  const savedWeight = weightResults[fishKey];
                  const isExpanded = expandedCrops.has(key);
                  const hasCropImg = !!crop.crop_url;
                  const hasGradcam =
                    !!crop.species.gradcam_url || !!crop.disease.gradcam_url;
                  const diseaseIsHealthy =
                    crop.disease.label.toLowerCase() === "healthy" ||
                    crop.disease.label.toLowerCase() === "healthy fish";

                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-border/40 bg-card overflow-hidden transition-all duration-300 hover:border-border/60 hover:bg-card/80 mb-4 shadow-sm"
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex gap-4">
                          {hasCropImg ? (
                            <img
                              src={resolveMLUrl(crop.crop_url)}
                              alt={crop.species.label}
                              className="w-20 h-20 rounded-xl border border-border/20 object-cover bg-black/10 shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-xl border border-border/20 bg-primary/5 flex items-center justify-center shrink-0">
                              <span className="text-2xl">🐟</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div>
                                <p className="text-xs text-muted-foreground/60 font-bold tracking-wider">
                                  Fish #{localIdx + 1}
                                </p>
                                <h3 className="text-lg font-bold text-foreground leading-tight truncate">
                                  {crop.species.label}
                                </h3>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-0.5 shrink-0 border-primary/20 text-primary font-bold bg-primary/5"
                              >
                                {(crop.species.confidence * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            <div
                              className={cn(
                                "inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold mt-1",
                                diseaseIsHealthy
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-amber-500/10 text-amber-600",
                              )}
                            >
                              <span>{diseaseIsHealthy ? "✓" : "⚠"}</span>
                              {crop.disease.label}
                            </div>
                          </div>
                        </div>

                        {/* Weight Estimation Section */}
                        {savedWeight ? (
                          /* ── Show saved results ── */
                          <div className="space-y-3 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-center p-2 rounded-xl bg-muted/10">
                                <p className="text-xs text-muted-foreground/50 font-medium mb-1">
                                  Est. Weight
                                </p>
                                <p className="text-sm font-bold">
                                  {(
                                    savedWeight.estimated_weight_grams / 1000
                                  ).toFixed(2)}{" "}
                                  kg
                                </p>
                              </div>
                              <div className="text-center p-2 rounded-xl bg-muted/10">
                                <p className="text-xs text-muted-foreground/50 font-medium mb-1">
                                  Value
                                </p>
                                <p className="text-sm font-bold">
                                  ₹{savedWeight.estimated_fish_value.min_inr}–
                                  {savedWeight.estimated_fish_value.max_inr}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-center p-2 rounded-xl bg-primary/5">
                                <p className="text-[11px] text-muted-foreground/50 font-medium mb-0.5">
                                  Weight Range
                                </p>
                                <p className="text-xs font-bold">
                                  {(
                                    savedWeight.estimated_weight_range
                                      .min_grams / 1000
                                  ).toFixed(2)}
                                  –
                                  {(
                                    savedWeight.estimated_weight_range
                                      .max_grams / 1000
                                  ).toFixed(2)}{" "}
                                  kg
                                </p>
                              </div>
                              <div className="text-center p-2 rounded-xl bg-primary/5">
                                <p className="text-[11px] text-muted-foreground/50 font-medium mb-0.5">
                                  Market Price
                                </p>
                                <p className="text-xs font-bold">
                                  ₹{savedWeight.market_price_per_kg.min_inr}–
                                  {savedWeight.market_price_per_kg.max_inr}/kg
                                </p>
                              </div>
                            </div>
                            {savedWeight.notes && (
                              <p className="text-[11px] text-muted-foreground/40 italic px-1">
                                {savedWeight.notes}
                              </p>
                            )}
                          </div>
                        ) : weightFormOpen[key] ? (
                          /* ── Show measurement form ── */
                          <div className="space-y-2 pt-1">
                            <div className="grid grid-cols-2 gap-1.5">
                              {(
                                [
                                  "length1",
                                  "length3",
                                  "height",
                                  "width",
                                ] as const
                              ).map((field) => (
                                <div key={field}>
                                  <label className="text-[9px] text-muted-foreground/50 font-medium block mb-0.5">
                                    {field === "length1"
                                      ? "Length 1 (cm)"
                                      : field === "length3"
                                        ? "Total Length (cm)"
                                        : field === "height"
                                          ? "Height (cm)"
                                          : "Width (cm)"}
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-border/20 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                    value={weightInputs[key]?.[field] || ""}
                                    onChange={(e) =>
                                      setWeightInputs((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...prev[key],
                                          [field]: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                            {weightErrors[key] && (
                              <p className="text-[9px] text-red-500 font-medium">
                                {weightErrors[key]}
                              </p>
                            )}
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-[10px] rounded-lg bg-primary font-semibold"
                                onClick={() =>
                                  handleWeightEstimate(
                                    key,
                                    globalIdx,
                                    crop.species.label,
                                  )
                                }
                                disabled={weightLoading[key]}
                              >
                                {weightLoading[key] ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />{" "}
                                    Estimating...
                                  </>
                                ) : (
                                  "Calculate Weight"
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] rounded-lg text-muted-foreground"
                                onClick={() =>
                                  setWeightFormOpen((prev) => ({
                                    ...prev,
                                    [key]: false,
                                  }))
                                }
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── Show button ── */
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-[10px] rounded-lg border-primary/20 text-primary hover:bg-primary/5 font-medium mt-1"
                            onClick={() =>
                              setWeightFormOpen((prev) => ({
                                ...prev,
                                [key]: true,
                              }))
                            }
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            Get Estimated Weight
                          </Button>
                        )}

                        {/* Grad-CAM toggle */}
                        {hasGradcam && (
                          <div className="pt-3 mt-3 border-t border-border/10">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-9 text-xs font-medium text-muted-foreground hover:text-foreground border-border/40 shadow-sm"
                              onClick={() => toggleCropExpand(key)}
                            >
                              <Bug className="w-3.5 h-3.5 mr-1.5 text-primary/70" />{" "}
                              {isExpanded ? "Hide" : "Show"} Heatmap
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 ml-auto" />
                              ) : (
                                <ChevronDown className="w-4 h-4 ml-auto" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      {isExpanded && hasGradcam && (
                        <div className="px-4 pb-4 pt-4 grid grid-cols-2 gap-3 border-t border-border/5 bg-black/5">
                          {crop.species.gradcam_url && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest text-center">
                                Species Heatmap
                              </p>
                              <img
                                src={resolveMLUrl(crop.species.gradcam_url)}
                                alt="Species Grad-CAM"
                                className="w-full h-auto rounded-xl border border-border/30 object-contain bg-black/10 shadow-sm hover:scale-[1.02] transition-transform"
                              />
                            </div>
                          )}
                          {crop.disease.gradcam_url && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest text-center">
                                Disease Heatmap
                              </p>
                              <img
                                src={resolveMLUrl(crop.disease.gradcam_url)}
                                alt="Disease Grad-CAM"
                                className="w-full h-auto rounded-xl border border-border/30 object-contain bg-black/10 shadow-sm hover:scale-[1.02] transition-transform"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-border/30 rounded-2xl bg-card/10">
                  <Images className="w-8 h-8 mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-muted-foreground">
                    No Fish Detected
                  </p>
                  <p className="text-xs text-muted-foreground/60 max-w-[200px] mt-1">
                    Detections fell below the minimum confidence threshold.
                  </p>
                </div>
              )}
            </div>

            {/* Map (if available) placed at the bottom */}
            {group.latitude && group.longitude && (
              <Card className="rounded-2xl border-border/15 overflow-hidden">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Location
                    Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="h-[200px] rounded-xl overflow-hidden border border-border/10 mb-2">
                    <MapContainer
                      center={[Number(group.latitude), Number(group.longitude)]}
                      zoom={10}
                      style={{ height: "100%", width: "100%" }}
                      zoomControl={false}
                    >
                      <TileLayer
                        url="https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                        attribution="Google Maps"
                      />
                      <Marker position={[Number(group.latitude), Number(group.longitude)]}>
                        <Popup>Scan location</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/70 font-mono">
                      Lat: {Number(group.latitude).toFixed(4)}, Lng:{" "}
                      {Number(group.longitude).toFixed(4)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps?q=${group.latitude},${group.longitude}`,
                          "_blank",
                        )
                      }
                    >
                      Open Map
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
