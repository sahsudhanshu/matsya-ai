/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
/* eslint-disable @next/next/no-img-element */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  Upload,
  Camera,
  FileText,
  Trash2,
  Zap,
  Info,
  MapPin,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
  Bug,
  X,
  ChevronLeft,
  ChevronRight,
  Images,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MLAnalysisResponse, MockCropSupplement } from "@/lib/types";
import { generateMockSupplement } from "@/lib/types";
import { jsPDF } from "jspdf";
import {
  createGroupPresignedUrls,
  uploadGroupToS3,
  analyzeGroup,
  getGroups,
  estimateFishWeight,
  saveWeightEstimate,
  type GroupRecord,
  type FishWeightEstimate,
} from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { resolveMLUrl } from "@/lib/constants";
import CameraModal from "@/components/CameraModal";
import { useAgentFirstStore } from "@/lib/stores/agent-first-store";
import { useAgentContext } from "@/lib/stores/agent-context-store";

type UploadStep = "idle" | "uploading" | "processing" | "done" | "error";

export interface UploadComponentProps {
  /** Callback to dispatch PaneMessage to AgentInterface */
  onPaneMessage?: (message: {
    id: string;
    type: "info" | "action" | "data" | "error" | "query";
    source: "upload";
    payload: Record<string, any>;
    timestamp: number;
    metadata?: {
      userInitiated: boolean;
      requiresResponse: boolean;
    };
  }) => void;
  /** Initial files to upload (optional) */
  initialFiles?: File[];
  /** Auto-analyze on mount if initialFiles provided */
  autoAnalyze?: boolean;
  /** Optional class for the outer container */
  className?: string;
}

export default function UploadComponent({
  onPaneMessage,
  initialFiles,
  autoAnalyze = false,
  className,
}: UploadComponentProps) {
  const router = useRouter();
  const setActiveComponent = useAgentFirstStore((s) => s.setActiveComponent);
  const { t } = useLanguage();

  // Multi-file state
  const [files, setFiles] = useState<File[]>(initialFiles || []);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);

  // Upload & analysis state
  const [step, setStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>(
    {},
  );
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Results state
  const [mlResults, setMlResults] = useState<MLAnalysisResponse[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // UI state
  const [dragActive, setDragActive] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [showCamera, setShowCamera] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [expandedCrops, setExpandedCrops] = useState<Set<string>>(new Set());

  // History state
  const [history, setHistory] = useState<GroupRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

  const handleWeightEstimate = async (cropKey: string, species: string) => {
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
      setWeightResults((prev) => ({ ...prev, [cropKey]: result }));
      setWeightFormOpen((prev) => ({ ...prev, [cropKey]: false }));

      // Update local history visually to reflect the new weight vs the old "mock/estimated" weight
      if (currentGroupId) {
        const fishIndex = parseInt(cropKey.replace(/\D/g, ""), 10) || 0;

        // Background sync to backend
        saveWeightEstimate({
          groupId: currentGroupId,
          imageIndex: currentResultIndex,
          fishIndex,
          species,
          weightG: result.estimated_weight_grams,
          fullEstimate: result,
        }).catch((e) => console.warn("Failed to save weight estimate", e));

        // Update local history array so sidebar/aggregate reflect new correct estimates immediately
        setHistory((prevHistory) =>
          prevHistory.map((group) => {
            if (group.groupId !== currentGroupId || !group.analysisResult)
              return group;

            // Estimate differences to adjust the aggregate (or recalculate them completely)
            let oldWeightVal = 0,
              oldPriceVal = 0;

            if (weightResults[cropKey]) {
              oldWeightVal =
                weightResults[cropKey].estimated_weight_grams / 1000;
              oldPriceVal =
                (weightResults[cropKey].estimated_fish_value.min_inr +
                  weightResults[cropKey].estimated_fish_value.max_inr) /
                2;
            } else {
              // Subtract initial mock values that were generated during initial aggregateStats calculation
              const mock = generateMockSupplement(species, fishIndex);
              oldWeightVal = mock.weight_kg;
              oldPriceVal = mock.estimatedValue;
            }

            const newWeightVal = result.estimated_weight_grams / 1000;
            const weightDiff = newWeightVal - oldWeightVal;

            const newPriceVal =
              (result.estimated_fish_value.min_inr +
                result.estimated_fish_value.max_inr) /
              2;
            const priceDiff = newPriceVal - oldPriceVal;

            return {
              ...group,
              analysisResult: {
                ...group.analysisResult,
                aggregateStats: {
                  ...group.analysisResult.aggregateStats,
                  totalEstimatedWeight: Math.max(
                    0,
                    group.analysisResult.aggregateStats.totalEstimatedWeight +
                    weightDiff,
                  ),
                  totalEstimatedValue: Math.max(
                    0,
                    group.analysisResult.aggregateStats.totalEstimatedValue +
                    priceDiff,
                  ),
                },
              },
            };
          }),
        );
      }
    } catch (err) {
      setWeightErrors((prev) => ({
        ...prev,
        [cropKey]: err instanceof Error ? err.message : "Estimation failed",
      }));
    } finally {
      setWeightLoading((prev) => ({ ...prev, [cropKey]: false }));
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // Current ML result being displayed
  const currentMlResult = mlResults[currentResultIndex] || null;

  const YOLO_CONFIDENCE_THRESHOLD = 0.3;

  const cropEntries = useMemo(() => {
    if (!currentMlResult?.crops) return [];
    return Object.entries(currentMlResult.crops)
      .filter(([, crop]) => crop.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD)
      .sort((a, b) => b[1].species.confidence - a[1].species.confidence);
  }, [currentMlResult]);

  // Get top species name for context
  const topSpeciesName = useMemo(() => {
    if (cropEntries.length === 0) return "";
    return cropEntries[0][1].species.label;
  }, [cropEntries]);

  const toggleCropExpand = (key: string) => {
    setExpandedCrops((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const response = await getGroups(10);
      setHistory(response.groups || []);
    } catch (err) {
      console.error("Failed to load upload history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [loadHistory]);

  // Get overall upload progress
  const overallUploadProgress = useMemo(() => {
    const progressValues = Object.values(uploadProgress);
    if (progressValues.length === 0) return 0;
    return Math.round(progressValues.reduce((a, b) => a + b, 0) / files.length);
  }, [uploadProgress, files.length]);

  // ── File Handling ───────────────────────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFiles(droppedFiles);
    }
  }, []);

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length !== newFiles.length) {
      toast.error("Some files were skipped (only images allowed)");
    }
    if (validFiles.length === 0) {
      toast.error(t("upload.imageError"));
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () =>
        setPreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });

    setMlResults([]);
    setStep("idle");
    setScanError(null);
    setExpandedCrops(new Set());
    setWeightFormOpen({});
    setWeightInputs({});
    setWeightLoading({});
    setWeightResults({});
    setWeightErrors({});

    if ("geolocation" in navigator && files.length === 0 && !location) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation(null),
      );
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));

    if (selectedPreviewIndex >= files.length - 1) {
      setSelectedPreviewIndex(Math.max(0, files.length - 2));
    } else if (selectedPreviewIndex > index) {
      setSelectedPreviewIndex((prev) => prev - 1);
    }
  };

  // ── Camera handling ────────────────────────────────────────────────────────
  const handleCameraClick = () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      mobileFileInputRef.current?.click();
    } else {
      if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        toast.error(t("camera.httpsRequired"));
        return;
      }
      setShowCamera(true);
    }
  };

  const handleCameraCapture = (capturedFile: File) => {
    handleFiles([capturedFile]);
    setShowCamera(false);
  };

  // ── Upload + Analyze Flow ──────────────────────────────────────────────────
  const startAnalysis = async () => {
    if (files.length === 0) return;

    try {
      setStep("uploading");
      setUploadProgress({});
      setScanError(null);
      setMlResults([]);
      setCurrentResultIndex(0);
      setWeightFormOpen({});
      setWeightInputs({});
      setWeightLoading({});
      setWeightResults({});
      setWeightErrors({});

      // Dispatch upload:started PaneMessage
      if (onPaneMessage) {
        onPaneMessage({
          id: `msg_${Date.now()}`,
          type: "info",
          source: "upload",
          payload: {
            event: "upload:started",
            imageCount: files.length,
          },
          timestamp: Date.now(),
          metadata: { userInitiated: true, requiresResponse: false },
        });
      }

      const fileMetadata = files.map((f) => ({
        fileName: f.name,
        fileType: f.type,
      }));
      const { groupId, presignedUrls } =
        await createGroupPresignedUrls(fileMetadata, location?.lat, location?.lng);
      setCurrentGroupId(groupId);

      await uploadGroupToS3(presignedUrls, files, (index, pct) => {
        setUploadProgress((prev) => ({ ...prev, [index]: pct }));

        // Dispatch upload:progress PaneMessage
        if (onPaneMessage && pct === 100) {
          onPaneMessage({
            id: `msg_${Date.now()}_${index}`,
            type: "info",
            source: "upload",
            payload: {
              event: "upload:progress",
              progress: Math.round(
                Object.values({ ...uploadProgress, [index]: pct }).reduce(
                  (a, b) => a + b,
                  0,
                ) / files.length,
              ),
            },
            timestamp: Date.now(),
            metadata: { userInitiated: false, requiresResponse: false },
          });
        }
      });

      // Dispatch upload:complete PaneMessage
      if (onPaneMessage) {
        onPaneMessage({
          id: `msg_${Date.now()}`,
          type: "data",
          source: "upload",
          payload: {
            event: "upload:complete",
            groupId,
            imageCount: files.length,
          },
          timestamp: Date.now(),
          metadata: { userInitiated: false, requiresResponse: false },
        });
      }

      setStep("processing");
      setAnalysisProgress(0);
      let isAnalysisComplete = false;
      const simulateProgress = () => {
        if (isAnalysisComplete) return;
        setAnalysisProgress((prev) => {
          // If we're already high, slow down drastically
          if (prev >= 95) return prev;

          let increment;
          if (prev < 40) increment = Math.floor(Math.random() * 15) + 5;
          else if (prev < 75) increment = Math.floor(Math.random() * 8) + 2;
          else increment = Math.floor(Math.random() * 3) + 1;

          return Math.min(prev + increment, 95);
        });
        const nextDelay = Math.floor(Math.random() * 400) + 200;
        setTimeout(simulateProgress, nextDelay);
      };
      simulateProgress();

      const { analysisResult } = await analyzeGroup(groupId, files.length);

      isAnalysisComplete = true;
      setAnalysisProgress(100);

      setMlResults(analysisResult.images as any);
      setStep("done");
      setExpandedCrops(new Set());

      await loadHistory();

      const totalFish = analysisResult.aggregateStats.totalFishCount;

      // Dispatch analysis:complete PaneMessage
      if (onPaneMessage) {
        onPaneMessage({
          id: `msg_${Date.now()}`,
          type: "data",
          source: "upload",
          payload: {
            event: "analysis:complete",
            groupId,
            imageCount: files.length,
            fishCount: totalFish,
            topSpecies: topSpeciesName,
            results: analysisResult,
          },
          timestamp: Date.now(),
          metadata: { userInitiated: false, requiresResponse: true },
        });
      }

      toast.success(
        `Analysis complete! ${totalFish} fish detected across ${files.length} images.`,
      );

      // Sync scan summary to agent context
      useAgentContext
        .getState()
        .setScanSummary(
          `${files.length} images, ${totalFish} fish, top species: ${topSpeciesName ?? "unknown"}`,
        );
    } catch (err) {
      setStep("error");
      const errorMessage =
        err instanceof Error ? err.message : t("upload.error");
      toast.error(errorMessage);

      // Dispatch error PaneMessage
      if (onPaneMessage) {
        onPaneMessage({
          id: `msg_${Date.now()}`,
          type: "error",
          source: "upload",
          payload: {
            event: "upload:error",
            error: errorMessage,
          },
          timestamp: Date.now(),
          metadata: { userInitiated: false, requiresResponse: false },
        });
      }
    }
  };

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const exportToPdf = async () => {
    if (mlResults.length === 0) return;

    // Show a loading toast since fetching images takes time
    const toastId = toast.loading("Generating PDF with images...");

    try {
      const doc = new jsPDF();
      const generatedAt = new Date().toLocaleString("en-IN");

      // --- Helper to fetch image as base64 ---
      const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(url, { mode: "cors" });
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      };

      // --- Title Page / Header ---
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("MatsyaAI Analysis Report", 14, 25);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Generated: ${generatedAt}`, 14, 35);
      doc.text(`Total Images Analyzed: ${mlResults.length}`, 14, 41);

      let cursorY = 55;
      let totalFish = 0;

      // Iterate over each uploaded image result
      for (let imgIdx = 0; imgIdx < mlResults.length; imgIdx++) {
        const result = mlResults[imgIdx];
        const cropList = Object.entries(result.crops ?? {});
        totalFish += cropList.length;

        if (cursorY > 250) {
          doc.addPage();
          cursorY = 20;
        }

        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.setDrawColor(226, 232, 240); // slate-200 line
        doc.line(14, cursorY - 5, 196, cursorY - 5);
        doc.text(`Image ${imgIdx + 1} - ${cropList.length} Fish Detected`, 14, cursorY + 5);
        cursorY += 15;

        // Iterate over crops
        for (let idx = 0; idx < cropList.length; idx++) {
          const [key, crop] = cropList[idx];

          if (cursorY > 230) {
            doc.addPage();
            cursorY = 20;
          }

          // Fetch the crop image
          let base64Img = null;
          if (crop.crop_url) {
            base64Img = await fetchImageAsBase64(crop.crop_url);
          }

          // Draw image box
          if (base64Img) {
            try {
              // Add image to PDF (x, y, width, height)
              doc.addImage(base64Img, "JPEG", 14, cursorY, 35, 35);
            } catch (e) {
              console.warn("Failed to add image to PDF", e);
              doc.setDrawColor(200);
              doc.rect(14, cursorY, 35, 35);
              doc.setFontSize(8);
              doc.text("Image failed", 16, cursorY + 18);
            }
          } else {
            doc.setDrawColor(200);
            doc.rect(14, cursorY, 35, 35);
            doc.setFontSize(8);
            doc.text("No image", 18, cursorY + 18);
          }

          // Write stats next to the image
          const textX = 55;
          let textY = cursorY + 6;

          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
          doc.text(`Fish #${idx + 1}: ${crop.species.label}`, textX, textY);

          textY += 8;
          doc.setFontSize(10);
          doc.setTextColor(71, 85, 105); // slate-600

          // Details
          doc.text(`Species Confidence: ${(crop.species.confidence * 100).toFixed(1)}%`, textX, textY);
          textY += 6;
          doc.text(`Condition: ${crop.disease.label} (${(crop.disease.confidence * 100).toFixed(1)}%)`, textX, textY);
          textY += 6;

          // Only show weight & value if the user has actively estimated it
          const estimate = weightResults[key];
          if (estimate) {
            const weightKg = (estimate.estimated_weight_grams / 1000).toFixed(2);
            doc.text(`Estimated Weight: ${weightKg} KG`, textX, textY);
            textY += 6;
            // Use 'Rs.' instead of unicode '₹' which causes jsPDF corruption in the built-in fonts
            doc.text(`Estimated Value: Rs. ${Math.round(estimate.estimated_fish_value.min_inr)} - ${Math.round(estimate.estimated_fish_value.max_inr)}`, textX, textY);
            textY += 6;
          } else {
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text(`Measurements: Not estimated yet`, textX, textY);
            doc.setTextColor(71, 85, 105);
            textY += 6;
          }

          cursorY += 45; // Move down for the next fish
        }

        cursorY += 10;
      }

      // --- Footer Summary ---
      if (cursorY > 260) {
        doc.addPage();
        cursorY = 20;
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(14, cursorY, 196, cursorY);
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`Summary: ${totalFish} total fish detected.`, 14, cursorY + 15);

      doc.save(`MatsyaAI_Report_${Date.now()}.pdf`);
      toast.success("PDF generated successfully!", { id: toastId });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Failed to generate PDF.", { id: toastId });
    }
  };

  const reset = () => {
    setFiles([]);
    setPreviews([]);
    setSelectedPreviewIndex(0);
    setMlResults([]);
    setCurrentResultIndex(0);
    setStep("idle");
    setUploadProgress({});
    setAnalysisProgress(0);
    setLocation(null);
    setScanError(null);
    setCurrentGroupId(null);
    setExpandedCrops(new Set());
    setWeightFormOpen({});
    setWeightInputs({});
    setWeightLoading({});
    setWeightResults({});
    setWeightErrors({});
  };

  const isAnalyzing = step === "uploading" || step === "processing";
  const isDisabled = isAnalyzing;
  const hasFiles = files.length > 0;
  const hasResults = mlResults.length > 0;

  // Sync image navigation between carousel and results
  const navigateImage = (direction: "prev" | "next") => {
    const maxIdx = Math.max(files.length - 1, mlResults.length - 1);
    if (direction === "prev") {
      const idx = Math.max(0, selectedPreviewIndex - 1);
      setSelectedPreviewIndex(idx);
      if (hasResults) setCurrentResultIndex(idx);
    } else {
      const idx = Math.min(maxIdx, selectedPreviewIndex + 1);
      setSelectedPreviewIndex(idx);
      if (hasResults) setCurrentResultIndex(idx);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── AGENT MODE (after analysis) ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasResults) {
    return (
      <div className={cn("h-full flex flex-col animate-fade-in", className)}>
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold leading-tight">
                Analysis Complete
              </h1>
              <p className="text-xs text-muted-foreground/60">
                {mlResults.length} {mlResults.length === 1 ? "image" : "images"}{" "}
                analyzed · {cropEntries.length} fish in current view
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPdf}
              className="h-8 rounded-xl border-border/30 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                currentGroupId &&
                setActiveComponent("history", {
                  selectedGroupId: currentGroupId,
                })
              }
              className="h-8 rounded-xl border-border/30 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Full Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const summary = `Scan complete: ${mlResults.length} images, ${cropEntries.length} fish detected.`;
                (window as any).__agentChatInject?.("Analyze scan results", {
                  label: "Analyze scan results",
                  detail: `${mlResults.length} images · ${cropEntries.length} fish`,
                  icon: "upload" as const,
                  backendText: `${summary} Analyze these results - what species were found, any diseases, and recommendations?`,
                });
              }}
              className="h-8 rounded-xl border-primary/30 text-primary text-xs font-medium hover:bg-primary/80 hover:text-white"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Discuss with AI
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="h-8 rounded-xl border-border/30 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              New Scan
            </Button>
          </div>
        </div>

        {/* ── Full-width analysis view ── */}
        <div className="flex-1 grid grid-cols-1 gap-4 min-h-0">
          {/* ── Image carousel + Analysis ── */}
          <div className="flex flex-col min-h-0 gap-3">
            {/* Image viewer */}
            <div
              className="relative rounded-2xl overflow-hidden border border-border/15 bg-card/30 backdrop-blur-sm flex-shrink-0 animate-slide-in-left"
              style={{ animationDuration: "0.5s" }}
            >
              <img
                src={previews[selectedPreviewIndex]}
                alt="Analysis"
                className="w-full h-auto max-h-[280px] sm:max-h-[320px] object-contain bg-black/10 transition-opacity duration-300"
              />
              {/* Navigation arrows */}
              {files.length > 1 && (
                <>
                  <button
                    onClick={() => navigateImage("prev")}
                    disabled={selectedPreviewIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigateImage("next")}
                    disabled={selectedPreviewIndex >= files.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              {/* Image counter */}
              {files.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {files.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedPreviewIndex(idx);
                        if (hasResults) setCurrentResultIndex(idx);
                      }}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        selectedPreviewIndex === idx
                          ? "w-6 bg-white"
                          : "w-1.5 bg-white/40 hover:bg-white/60",
                      )}
                    />
                  ))}
                </div>
              )}
              {location && (
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[9px] font-mono">
                  <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                  {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                </div>
              )}
            </div>

            {/* ── Thumbnails (if >1 image) ── */}
            {files.length > 1 && (
              <div className="flex gap-1.5 px-1 overflow-x-auto scrollbar-none shrink-0">
                {previews.map((preview, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedPreviewIndex(idx);
                      if (hasResults) setCurrentResultIndex(idx);
                    }}
                    className={cn(
                      "shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
                      selectedPreviewIndex === idx
                        ? "border-primary ring-1 ring-primary/20 scale-105"
                        : "border-transparent opacity-60 hover:opacity-90",
                    )}
                  >
                    <img
                      src={preview}
                      alt=""
                      className="w-12 h-12 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* ── Fish detection results ── */}
            <div
              className="flex-1 overflow-y-auto min-h-0 space-y-4 animate-fade-in-up"
              style={{ animationDelay: "0.1s" }}
            >
              {/* YOLO overview */}
              {currentMlResult?.yolo_image_url && (
                <div className="rounded-xl border border-border/40 overflow-hidden bg-background mb-4 shadow-sm">
                  <button
                    onClick={() => toggleCropExpand("yolo_overview")}
                    className="w-full flex items-center justify-between p-3.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" /> YOLO
                      Detection View
                    </span>
                    {expandedCrops.has("yolo_overview") ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {expandedCrops.has("yolo_overview") && (
                    <div className="p-3 border-t border-border/40 bg-black/5">
                      <img
                        src={resolveMLUrl(currentMlResult.yolo_image_url)}
                        alt="YOLO"
                        className="w-full object-contain max-h-[250px] rounded-lg border border-border/20 bg-background/50"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Fish cards */}
              {cropEntries.length > 0 ? (
                <div className="space-y-2">
                  {cropEntries.map(([key, crop], idx) => {
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
                        className="rounded-xl border border-border/40 bg-card overflow-hidden transition-all mb-4 shadow-sm"
                      >
                        <div className="p-4 space-y-4">
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
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground/60 font-medium">
                                    Fish #{idx + 1}
                                  </p>
                                  <h3 className="text-lg font-bold text-primary leading-tight truncate">
                                    {crop.species.label}
                                  </h3>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2 py-0.5 shrink-0 border-primary/20 text-primary/80 font-bold bg-primary/5"
                                >
                                  {(crop.species.confidence * 100).toFixed(0)}%
                                </Badge>
                              </div>
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mt-1",
                                  diseaseIsHealthy
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                )}
                              >
                                <span>{diseaseIsHealthy ? "✓" : "⚠"}</span>
                                {crop.disease.label}
                              </div>
                            </div>
                          </div>

                          {/* Weight Estimation Section */}
                          {weightResults[key] && !weightFormOpen[key] ? (
                            /* ── Show results ── */
                            <div className="space-y-3 pt-2">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-2 rounded-xl bg-muted/10">
                                  <p className="text-xs text-muted-foreground/50 font-medium mb-1">
                                    Est. Weight
                                  </p>
                                  <p className="text-sm font-bold">
                                    {(
                                      weightResults[key]
                                        .estimated_weight_grams / 1000
                                    ).toFixed(2)}{" "}
                                    kg
                                  </p>
                                </div>
                                <div className="text-center p-2 rounded-xl bg-muted/10">
                                  <p className="text-xs text-muted-foreground/50 font-medium mb-1">
                                    Value
                                  </p>
                                  <p className="text-sm font-bold">
                                    ₹
                                    {
                                      (weightResults[key].market_price_per_kg
                                        .min_inr +
                                        weightResults[key].market_price_per_kg
                                          .max_inr) / 2
                                    }
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
                                      weightResults[key].estimated_weight_range
                                        .min_grams / 1000
                                    ).toFixed(2)}
                                    –
                                    {(
                                      weightResults[key].estimated_weight_range
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
                                    ₹
                                    {
                                      weightResults[key].market_price_per_kg
                                        .min_inr
                                    }
                                    –
                                    {
                                      weightResults[key].market_price_per_kg
                                        .max_inr
                                    }
                                    /kg
                                  </p>
                                </div>
                              </div>
                              {weightResults[key].notes && (
                                <p className="text-[11px] text-muted-foreground/40 italic px-1">
                                  {weightResults[key].notes}
                                </p>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-[11px] rounded-lg border-primary/20 text-primary hover:bg-primary/5 mt-1"
                                onClick={() =>
                                  setWeightFormOpen((prev) => ({
                                    ...prev,
                                    [key]: true,
                                  }))
                                }
                              >
                                Recalculate Weight
                              </Button>
                            </div>
                          ) : weightFormOpen[key] ? (
                            /* ── Show measurement form ── */
                            <div className="space-y-3 pt-2">
                              <div className="grid grid-cols-2 gap-2.5">
                                {(
                                  [
                                    "length1",
                                    "length3",
                                    "height",
                                    "width",
                                  ] as const
                                ).map((field) => (
                                  <div key={field}>
                                    <label className="text-xs text-muted-foreground/60 font-medium block mb-1">
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
                                      className="w-full px-3 py-2 text-sm rounded-lg border border-border/40 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
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
                                <p className="text-xs text-red-500 font-medium">
                                  {weightErrors[key]}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1 h-9 text-xs rounded-lg bg-primary font-semibold"
                                  onClick={() =>
                                    handleWeightEstimate(
                                      key,
                                      crop.species.label,
                                    )
                                  }
                                  disabled={weightLoading[key]}
                                >
                                  {weightLoading[key] ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                                      Estimating...
                                    </>
                                  ) : (
                                    "Calculate Weight"
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 text-xs rounded-lg text-muted-foreground"
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
                              className="w-full h-9 text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/5 font-semibold mt-2"
                              onClick={() =>
                                setWeightFormOpen((prev) => ({
                                  ...prev,
                                  [key]: true,
                                }))
                              }
                            >
                              <Zap className="w-3.5 h-3.5 mr-1.5" />
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
                                <Bug className="w-3.5 h-3.5 mr-1.5" /> Grad-CAM
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
                          <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-3">
                            {crop.species.gradcam_url && (
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground/70">
                                  Species
                                </p>
                                <img
                                  src={resolveMLUrl(crop.species.gradcam_url)}
                                  alt="Species Grad-CAM"
                                  className="w-full h-auto rounded-xl border border-border/30 shadow-sm object-contain bg-black/5"
                                />
                              </div>
                            )}
                            {crop.disease.gradcam_url && (
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground/70">
                                  Disease
                                </p>
                                <img
                                  src={resolveMLUrl(crop.disease.gradcam_url)}
                                  alt="Disease Grad-CAM"
                                  className="w-full h-auto rounded-xl border border-border/30 shadow-sm object-contain bg-black/5"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : currentMlResult && cropEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 opacity-40">
                  <Eye className="w-10 h-10 mb-3" />
                  <p className="text-sm font-bold">{t("upload.noFishDetected")}</p>
                  <p className="text-xs text-muted-foreground">
                    Below {Math.round(YOLO_CONFIDENCE_THRESHOLD * 100)}%
                    threshold
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── UPLOAD MODE (before analysis) ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className={cn(
        "max-w-5xl mx-auto space-y-6 pb-10 animate-fade-in-up",
        className,
      )}
      style={{ animationDuration: "0.4s" }}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {t("upload.title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground/60">
            {t("upload.subtitle")}
          </p>
        </div>
      </div>

      {/* Upload area */}
      <Card className="rounded-2xl border border-dashed border-border/30 bg-card/20 backdrop-blur-sm overflow-hidden transition-all duration-300">
        <CardContent className="p-0">
          {!hasFiles ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center p-8 sm:p-14 text-center min-h-[320px] transition-all duration-500 cursor-pointer",
                dragActive ? "bg-primary/3 scale-[0.995]" : "bg-transparent",
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500",
                  dragActive
                    ? "bg-primary text-white scale-110 rotate-3"
                    : "bg-primary/8 text-primary",
                )}
              >
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold mb-1.5">
                {dragActive ? t("upload.dropHere") : t("upload.uploadFishImages")}
              </h3>
              <p className="text-xs text-muted-foreground/50 mb-6 max-w-[280px] mx-auto">
                {t("upload.dragDropBrowse")}
              </p>
              <div
                className="flex flex-wrap items-center justify-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl h-10 px-5 bg-primary font-semibold text-xs"
                >
                  {t("upload.browse")}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl h-10 px-5 border-border/20 font-semibold text-xs"
                  onClick={handleCameraClick}
                >
                  <Camera className="mr-1.5 w-4 h-4" />
                  {t("upload.camera")}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* Main Image Display */}
              <div className="relative group">
                <img
                  src={previews[selectedPreviewIndex]}
                  alt="Selected Preview"
                  className="w-full h-auto max-h-[350px] object-contain rounded-t-2xl bg-black/10 transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6 gap-3">
                  <Button
                    variant="secondary"
                    className="rounded-xl font-semibold bg-white/90 text-black text-xs h-9"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isDisabled}
                  >
                    Add More
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-xl font-semibold text-xs h-9"
                    onClick={reset}
                    disabled={isDisabled}
                  >
                    <Trash2 className="mr-1.5 w-3.5 h-3.5" />{t("upload.clear")}</Button>
                </div>
                {location && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[9px] font-mono">
                    <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                    {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                  </div>
                )}
                {files.length > 1 && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold">
                    <Images className="w-3 h-3 inline mr-1" />
                    {selectedPreviewIndex + 1} / {files.length}
                  </div>
                )}
              </div>

              {/* Preview thumbnails */}
              {files.length > 1 && (
                <div className="p-3 border-t border-border/10 bg-muted/5">
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                    {previews.map((preview, idx) => (
                      <button
                        key={idx}
                        className={cn(
                          "relative shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
                          selectedPreviewIndex === idx
                            ? "border-primary ring-1 ring-primary/15"
                            : "border-transparent opacity-50 hover:opacity-80",
                        )}
                        onClick={() => setSelectedPreviewIndex(idx)}
                      >
                        <img
                          src={preview}
                          alt=""
                          className="w-14 h-14 object-cover"
                        />
                        {step === "idle" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {hasFiles && step === "idle" && !hasResults && (
          <CardFooter className="p-4 border-t border-border/10 bg-card/20 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
              <FileText className="w-3.5 h-3.5" />
              {files.length} {files.length === 1 ? "image" : "images"} ready
            </div>
            <Button
              onClick={startAnalysis}
              className="w-full sm:w-auto rounded-xl h-10 px-6 bg-primary font-semibold shadow-sm shadow-primary/10 transition-all active:scale-95 text-sm"
            >
              Start Analysis
              <Zap className="ml-1.5 w-3.5 h-3.5 fill-white" />
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Progress */}
      {step === "uploading" && (
        <Card className="rounded-2xl border-border/15 bg-card/20 backdrop-blur-sm p-5 space-y-3 animate-scale-in">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              Uploading {files.length} {files.length === 1 ? "image" : "images"}
            </span>
            <span className="text-primary font-bold text-sm">
              {overallUploadProgress}%
            </span>
          </div>
          <Progress
            value={overallUploadProgress}
            className="h-2 rounded-full bg-primary/5"
          />
        </Card>
      )}

      {step === "processing" && (
        <Card className="rounded-2xl border-border/15 bg-card/20 backdrop-blur-sm p-5 space-y-3 animate-scale-in">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-gentle-pulse" />
              Analyzing with AI
            </span>
            <span className="text-primary font-bold text-sm">
              {analysisProgress}%
            </span>
          </div>
          <Progress
            value={analysisProgress}
            className="h-2 rounded-full bg-primary/5"
          />
          <p className="text-[10px] text-muted-foreground/40 text-center">
            {t("upload.analyzingPills")}
          </p>
        </Card>
      )}

      {/* Tips */}
      {step !== "processing" && step !== "uploading" && (
        <div
          className="rounded-2xl bg-muted/30 border border-border/40 p-4 sm:p-5 animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex gap-3 sm:gap-4">
            <div className="p-2 bg-primary/10 rounded-xl text-primary h-fit shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-semibold text-sm sm:text-[15px] text-foreground/90">
                {t("upload.tips")}
              </h4>
              <ul className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed space-y-1">
                <li>• {t("upload.tip2")}</li>
                <li>• {t("upload.tip3")}</li>
                <li>• Upload multiple images for batch analysis</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recent History */}
      {history.length > 0 && (
        <div
          className="space-y-3 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          <h2 className="text-sm font-bold text-muted-foreground/50">
            Recent Analyses
          </h2>
          <div className="space-y-2">
            {history.slice(0, 5).map((group) => {
              const stats = group.analysisResult?.aggregateStats;
              const fishCount = stats?.totalFishCount ?? 0;

              return (
                <div
                  key={group.groupId}
                  className="rounded-xl border border-border/15 bg-card/15 p-3 flex items-center justify-between gap-3 hover:bg-card/30 transition-colors duration-200 cursor-pointer"
                  onClick={() =>
                    setActiveComponent("history", {
                      selectedGroupId: group.groupId,
                    })
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg border border-border/10 bg-primary/5 flex items-center justify-center text-primary">
                      <Images className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {group.imageCount}{" "}
                        {group.imageCount === 1 ? "Image" : "Images"}
                        {fishCount > 0 && (
                          <span className="text-muted-foreground/40 ml-1.5">
                            · {fishCount} fish
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground/40">
                        {new Date(group.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[9px] px-2 py-0.5 font-semibold border-none",
                        group.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : group.status === "failed"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-amber-500/10 text-amber-500",
                      )}
                    >
                      {group.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Always-mounted hidden file inputs so refs are valid in all states */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
        accept="image/*"
        multiple
      />
      <input
        type="file"
        ref={mobileFileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
        accept="image/*"
        capture="environment"
        multiple
      />

      {/* Camera Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
