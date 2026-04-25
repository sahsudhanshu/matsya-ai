import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  getPresignedUrl,
  uploadToS3,
  analyzeImage,
  createGroupPresignedUrls,
  uploadGroupToS3,
  analyzeGroup,
} from "../../lib/api-client";
import type {
  FishAnalysisResult,
  GroupAnalysis,
  MLCropResult,
} from "../../lib/types";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  IS_DEMO_MODE,
} from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import {
  translateFishName,
  translateDiseaseName,
} from "../../lib/i18n/species-i18n";
import { useNetwork } from "../../lib/network-context";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { normalizeGroupAnalysisUrls } from "../../lib/url-utils";
import ImageSlider from "../../components/ImageSlider";
import {
  loadModel,
  reloadModel,
  getModelDebugInfo,
  type BoundingBox,
} from "../../lib/detection";
import {
  loadAllTFLiteModels,
  reloadTFLiteModels,
  getTFLiteModelDebugInfo,
  type TFLiteModelDebugInfo,
} from "../../lib/tflite-inference";
import {
  runOfflineInference,
  offlineResultToAnalysisResult,
  type OfflineDetectionResult,
} from "../../lib/offline-inference";
import { BoundingBoxOverlay } from "../../components/BoundingBoxOverlay";
import { generateMockSupplement } from "../../lib/species-data";
import { setAnalysisData, getAnalysisData } from "../../lib/analysis-store";
import { toastService } from "../../lib/toast-service";
import {
  saveLocalAnalysis,
  updateLocalDetectionWeight,
} from "../../lib/local-history";
import { SyncService } from "../../lib/sync-service";
import { ProfileMenu } from "../../components/ui/ProfileMenu";

const YOLO_CONFIDENCE_THRESHOLD = 0.3;
const SCREEN_WIDTH = Dimensions.get("window").width;
const IS_COMPACT_SCREEN = SCREEN_WIDTH < 390;

type Step = "idle" | "uploading" | "processing" | "done" | "error";

const CACHE_HINT_MESSAGE =
  "If you think this error is incorrect, try clearing your cache and retrying.";

export default function UploadScreen() {
  const { t, locale, isLoaded } = useLanguage();
  const { effectiveMode, connectionQuality } = useNetwork();

  // Multi-image state
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null); // Keep for backward compat

  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>(
    {},
  );
  const [result, setResult] = useState<FishAnalysisResult | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Group analysis state
  const [groupAnalysis, setGroupAnalysis] = useState<GroupAnalysis | null>(
    null,
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ── Detection state ──
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [detectionTime, setDetectionTime] = useState<number | null>(null);
  const [cropUris, setCropUris] = useState<string[]>([]);
  const [modelError, setModelError] = useState(false);
  const [isReloadingModel, setIsReloadingModel] = useState(false);
  const [modelName, setModelName] = useState<string>(
    "detection_float32.tflite",
  );
  const [modelSource, setModelSource] = useState<string>("not loaded");

  // ── Offline inference state ──
  const [offlineResults, setOfflineResults] = useState<
    OfflineDetectionResult[]
  >([]);
  const [offlineProcessingTime, setOfflineProcessingTime] = useState<
    number | null
  >(null);
  const [analysisMode, setAnalysisMode] = useState<"online" | "offline" | null>(
    null,
  );
  // ── User-requested offline mode ──
  const [forceOffline, setForceOffline] = useState(false);
  // Step label shown during offline inference
  const [offlineStep, setOfflineStep] = useState<string>("");

  // ── TFLite classification model state ──
  const [tfliteInfo, setTfliteInfo] = useState<TFLiteModelDebugInfo | null>(
    null,
  );
  const [tfliteLoading, setTfliteLoading] = useState(false);
  const [tfliteError, setTfliteError] = useState<string | null>(null);

  const [uploadGroupId, setUploadGroupId] = useState<string | null>(null);

  const refreshModelStatus = () => {
    const info = getModelDebugInfo();
    setModelName(info.modelName);
    setModelSource(info.loadedUri ?? "not loaded");
    setModelError(!info.isLoaded);
  };

  const refreshTfliteStatus = () => {
    setTfliteInfo(getTFLiteModelDebugInfo());
  };

  // Re-sync offlineResults from the store when the tab is focused again.
  // This ensures weights entered in the detail screen propagate back here.
  useFocusEffect(
    useCallback(() => {
      const stored = getAnalysisData();
      if (stored?.mode === "offline") {
        setOfflineResults([...stored.offlineResults]);
      }
    }, []),
  );

  // Preload all models on mount
  useEffect(() => {
    // TFLite detection model
    loadModel()
      .then(() => refreshModelStatus())
      .catch(() => {
        setModelError(true);
        setModelSource("missing");
        toastService.error(
          "Detection model unavailable - run: npm run deploy-models",
        );
      });

    // TFLite species + disease models
    setTfliteLoading(true);
    loadAllTFLiteModels()
      .then(() => {
        refreshTfliteStatus();
        setTfliteError(null);
      })
      .catch((err) => {
        refreshTfliteStatus();
        const msg = err instanceof Error ? err.message : String(err);
        setTfliteError(msg);
        toastService.error(
          "Species/disease models unavailable - run: npm run deploy-models",
        );
      })
      .finally(() => setTfliteLoading(false));
  }, []);

  // After scan completes → navigate directly to chat with full scan context
  useEffect(() => {
    if (step !== "done") return;

    const navigateToChat = () => {
      if (groupAnalysis) {
        // Online analysis
        const speciesList = Object.keys(
          groupAnalysis.aggregateStats.speciesDistribution,
        ).join(", ");
        const detections = groupAnalysis.detections ?? [];
        const fishSummary = detections
          .map(
            (d, i) =>
              `Fish #${i + 1}: ${d.species} (${(d.confidence * 100).toFixed(0)}% conf, ${d.diseaseStatus})`,
          )
          .join("; ");

        const prompt = [
          `I just scanned ${groupAnalysis.aggregateStats.totalFishCount} fish across ${groupAnalysis.images.length} image(s).`,
          `Species: ${speciesList}.`,
          fishSummary ? `Details: ${fishSummary}.` : "",
          groupAnalysis.aggregateStats.diseaseDetected
            ? "⚠️ Some fish show signs of disease!"
            : "All fish appear healthy.",
          "Please give me a detailed summary with species info, health assessment, and market recommendations.",
        ]
          .filter(Boolean)
          .join(" ");

        router.push({
          pathname: "/(tabs)/chat",
          params: {
            scanComplete: "true",
            groupId: uploadGroupId || "",
            scanMode: "online",
            initialMessage: prompt,
          },
        });
      }
    };

    // Small delay to let UI settle before navigation
    const timer = setTimeout(navigateToChat, 800);
    return () => clearTimeout(timer);
  }, [step, groupAnalysis, offlineResults, uploadGroupId]);

  const handleReloadModel = async () => {
    setIsReloadingModel(true);
    try {
      // Reload all models in parallel
      await Promise.allSettled([
        reloadModel().then(() => refreshModelStatus()),
        reloadTFLiteModels().then(() => {
          refreshTfliteStatus();
          setTfliteError(null);
        }),
      ]);
      refreshModelStatus();
      refreshTfliteStatus();
    } catch {
      setModelError(true);
      setModelSource("missing");
      Alert.alert(
        "Model Reload Failed",
        "Could not reload one or more models from device storage.",
      );
    } finally {
      setIsReloadingModel(false);
    }
  };

  const isAnalyzing = step === "uploading" || step === "processing";

  const animateProgress = (to: number) => {
    Animated.timing(progressAnim, {
      toValue: to,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setProgress(to);
  };

  const captureLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch {
      /* optional */
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.error"), "Please allow access to your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.8,
      allowsEditing: false,
      allowsMultipleSelection: true, // Enable multi-select
    });
    if (!result.canceled && result.assets.length > 0) {
      const uris = result.assets.map((asset) => asset.uri);
      setImageUris(uris);
      setImageUri(uris[0]); // Set first as primary for backward compat
      setResult(null);
      setGroupAnalysis(null);
      setCurrentImageIndex(0);
      setStep("idle");
      captureLocation();
    }
  };

  const captureFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.error"), "Please allow access to your camera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUris([uri]);
      setImageUri(uri);
      setResult(null);
      setGroupAnalysis(null);
      setCurrentImageIndex(0);
      setStep("idle");
      captureLocation();
    }
  };

  // ── Decide whether to use offline or online mode ──
  const isMultiImage = imageUris.length > 1;

  const startAnalysis = async () => {
    if (imageUris.length === 0 && !imageUri) return;

    // Reset state
    setDetections([]);
    setCropUris([]);
    setDetectionTime(null);
    setOfflineResults([]);
    setOfflineProcessingTime(null);
    setResult(null);
    setGroupAnalysis(null);
    setUploadGroupId(null);
    setUploadProgress({});
    setCurrentImageIndex(0);

    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("  🚀  ANALYSIS STARTED");
    const isOffline =
      IS_DEMO_MODE || effectiveMode === "offline" || forceOffline;
    console.log(
      `  Mode          : ${isOffline ? `OFFLINE (${IS_DEMO_MODE ? "demo" : "network unavailable"})` : "ONLINE (cloud) → offline fallback"}`,
    );
    console.log(
      `  Network       : ${effectiveMode} (quality: ${connectionQuality})`,
    );
    console.log(`  Demo mode     : ${IS_DEMO_MODE}`);
    console.log(`  Image count   : ${imageUris.length}`);
    console.log("╚════════════════════════════════════════════════════╝\n");

    if (isOffline) {
      // ═══════════════════════════════════════════════════
      // OFFLINE PATH: Full on-device pipeline (single image only)
      // ═══════════════════════════════════════════════════
      const targetUri = imageUri || imageUris[0];
      if (!targetUri) return;

      setAnalysisMode("offline");
      try {
        // Step 1: Show detecting state
        setIsDetecting(true);
        setStep("processing");
        animateProgress(0);
        setOfflineStep("Starting on-device pipeline…");
        console.log("[Upload] 🔍 Starting offline inference pipeline…");

        // Step 2: Run the full offline inference pipeline with real progress
        const pipelineStart = Date.now();
        const {
          detections: offlineDets,
          processingTime,
          errors,
        } = await runOfflineInference(targetUri, ({ percent, step }) => {
          animateProgress(percent);
          setOfflineStep(step);
        });

        setOfflineStep("");

        console.log(
          `[Upload] ✅ Offline inference complete: ${offlineDets.length} fish in ${processingTime}ms`,
        );
        if (errors && errors.length > 0) {
          console.warn("[Upload] ⚠️ Pipeline errors:", errors);
        }

        // Store offline results
        setOfflineResults(offlineDets);
        setOfflineProcessingTime(processingTime);
        setIsDetecting(false);

        // Save to analysis store for detailed report page
        setAnalysisData({
          mode: "offline",
          offlineResults: offlineDets,
          processingTime,
          imageUri: targetUri,
          location,
        });

        // Persist locally for offline history (queued for backend sync)
        saveLocalAnalysis({
          mode: "offline",
          offlineResults: offlineDets,
          processingTime,
          imageUri: targetUri,
          location,
        })
          .then((record) => {
            // Patch the local record ID into the store so the detail screen
            // can update the persisted record when the user enters measurements.
            const current = getAnalysisData();
            if (current?.mode === "offline") {
              current.localRecordId = record.id;
            }
            // Push fresh counts to the sync indicator in the header.
            SyncService.refreshStatus();
          })
          .catch((e) => console.warn("[Upload] Local history save failed:", e));

        // Extract detection boxes for the BoundingBoxOverlay
        if (offlineDets.length > 0) {
          // Reconstruct BoundingBox[] from offline results for overlay
          const imgDims = await new Promise<{ w: number; h: number }>(
            (resolve) => {
              Image.getSize(
                targetUri,
                (w, h) => resolve({ w, h }),
                () => resolve({ w: 1, h: 1 }),
              );
            },
          );

          const boxes: BoundingBox[] = offlineDets.map((d, i) => ({
            x1: d.bbox[0] / imgDims.w,
            y1: d.bbox[1] / imgDims.h,
            x2: d.bbox[2] / imgDims.w,
            y2: d.bbox[3] / imgDims.h,
            classId: 0,
            confidence: d.speciesConfidence,
          }));
          setDetections(boxes);
          setDetectionTime(processingTime);

          // Collect crop URIs from offline results
          const crops = offlineDets
            .filter((d) => d.cropUri)
            .map((d) => d.cropUri!);
          setCropUris(crops);
        } else if (errors && errors.length > 0) {
          // Inference pipeline hit an error (e.g. TFLite model corruption)
          // - distinguish from a genuine "no fish" result.
          console.warn("[Upload] ⚠️ Offline inference errors - not a real detection result");
          Alert.alert(
            "Analysis Error",
            `The on-device model encountered an error.\n\n${CACHE_HINT_MESSAGE}`,
          );
        } else {
          console.warn("[Upload] ⚠️ No fish detected in image");
          Alert.alert(
            "No Fish Detected",
            "The detection model did not find any fish in this image. Try a clearer photo.",
          );
        }

        animateProgress(100);
        setStep(offlineDets.length > 0 ? "done" : "error");
      } catch (e: any) {
        setIsDetecting(false);
        setStep("error");
        console.error("[Upload] ❌ Offline analysis failed:", e.message);
        const errorMessage = e.message || t("common.error");
        Alert.alert(
          "Offline Analysis Failed",
          `${errorMessage}\n\n${CACHE_HINT_MESSAGE}`,
        );
      }
    } else if (isMultiImage) {
      // ═══════════════════════════════════════════════════
      // ONLINE PATH - MULTI-IMAGE: Group upload + analysis
      // (only reached when network is available)
      // ═══════════════════════════════════════════════════
      setAnalysisMode("online");
      try {
        // Step 1: Get group presigned URLs
        setStep("uploading");
        animateProgress(0);
        console.log("[Upload] ☁️ Getting group presigned URLs…");

        const files = imageUris.map((uri, idx) => ({
          fileName: `catch_${Date.now()}_${idx}.jpg`,
          fileType: "image/jpeg",
        }));

        const { groupId, presignedUrls } = await createGroupPresignedUrls(
          files,
          location?.lat,
          location?.lng,
        );
        console.log(
          `[Upload] ✅ Got group presigned URLs for groupId: ${groupId}`,
        );

        // Step 2: Upload all images concurrently
        console.log("[Upload] ☁️ Uploading images to S3…");
        const fileTypes = imageUris.map(() => "image/jpeg");
        await uploadGroupToS3(
          presignedUrls,
          imageUris,
          fileTypes,
          (index, pct) => {
            setUploadProgress((prev) => ({ ...prev, [index]: pct }));
            // Calculate overall progress
            const totalProgress =
              Object.values({ ...uploadProgress, [index]: pct }).reduce(
                (sum, p) => sum + p,
                0,
              ) / imageUris.length;
            animateProgress(totalProgress);
          },
        );
        animateProgress(100);
        console.log("[Upload] ✅ All images uploaded");

        // Step 3: Analyze group via cloud
        setStep("processing");
        animateProgress(0);
        console.log("[Upload] 🧠 Requesting group analysis…");
        let isAnalysisComplete = false;
        const simulateProgress = () => {
          if (isAnalysisComplete) return;
          setProgress((prev) => {
            if (prev >= 95) return prev;

            let increment;
            if (prev < 40) increment = Math.floor(Math.random() * 15) + 5;
            else if (prev < 75) increment = Math.floor(Math.random() * 8) + 2;
            else increment = Math.floor(Math.random() * 3) + 1;

            const next = Math.min(prev + increment, 95);
            Animated.timing(progressAnim, {
              toValue: next,
              duration: 250,
              useNativeDriver: false,
            }).start();
            return next;
          });
          const nextDelay = Math.floor(Math.random() * 400) + 200;
          setTimeout(simulateProgress, nextDelay);
        };
        simulateProgress();

        const { analysisResult } = await analyzeGroup(groupId);
        isAnalysisComplete = true;
        animateProgress(100);

        // Print raw JSON response
        console.log("[Upload] ☁️ Raw Cloud Analysis Response (JSON):");
        console.log(JSON.stringify(analysisResult, null, 2));

        console.log("[Upload] ☁️ Group analysis complete");
        console.log(
          `  • Total fish: ${analysisResult.aggregateStats.totalFishCount}`,
        );
        console.log(`  • Images processed: ${analysisResult.images.length}`);
        console.log(
          `  • Total weight: ${analysisResult.aggregateStats.totalEstimatedWeight}kg`,
        );
        console.log(
          `  • Total value: ₹${analysisResult.aggregateStats.totalEstimatedValue}`,
        );

        // Normalize URLs to ensure gradcam and crop images load correctly
        const normalizedAnalysis = normalizeGroupAnalysisUrls(analysisResult);
        // Save to analysis store for detailed report page
        setAnalysisData({
          mode: "online",
          groupAnalysis: normalizedAnalysis,
          groupId,
          imageUris,
          location,
        });
        setGroupAnalysis(normalizedAnalysis);
        setUploadGroupId(groupId);
        setStep("done");
      } catch (e: any) {
        console.error(`[Upload] ☁️ Group analysis failed: ${e.message}`);
        setStep("error");
        Alert.alert("Group Analysis Failed", e.message || t("common.error"));
      }
    } else {
      // ═══════════════════════════════════════════════════
      // ONLINE PATH - SINGLE IMAGE: Cloud upload + analysis (using GROUP API)
      // Note: Always try online first; fall back to offline on failure.
      // ═══════════════════════════════════════════════════
      const targetUri = imageUri || imageUris[0];
      if (!targetUri) return;

      setAnalysisMode("online");
      try {
        // Step 1: Get group presigned URLs (for single image as a group of one)
        setStep("uploading");
        animateProgress(0);
        console.log(
          "[Upload] ☁️ Getting group presigned URL for single image…",
        );

        const files = [
          {
            fileName: `catch_${Date.now()}.jpg`,
            fileType: "image/jpeg",
          },
        ];

        const { groupId, presignedUrls } = await createGroupPresignedUrls(
          files,
          location?.lat,
          location?.lng,
        );
        console.log(
          `[Upload] ✅ Got group presigned URL for groupId: ${groupId}`,
        );

        // Step 2: Upload image
        console.log("[Upload] ☁️ Uploading to S3…");
        const fileTypes = ["image/jpeg"];
        await uploadGroupToS3(
          presignedUrls,
          [targetUri],
          fileTypes,
          (index, pct) => animateProgress(pct),
        );
        animateProgress(100);
        console.log("[Upload] ✅ Upload complete");

        // Step 3: Analyze via cloud using group API
        setStep("processing");
        animateProgress(0);
        console.log("[Upload] 🧠 Requesting cloud analysis (group API)…");
        let isAnalysisComplete = false;
        const simulateProgress = () => {
          if (isAnalysisComplete) return;
          setProgress((prev) => {
            if (prev >= 95) return prev;

            let increment;
            if (prev < 40) increment = Math.floor(Math.random() * 15) + 5;
            else if (prev < 75) increment = Math.floor(Math.random() * 8) + 2;
            else increment = Math.floor(Math.random() * 3) + 1;

            const next = Math.min(prev + increment, 95);
            Animated.timing(progressAnim, {
              toValue: next,
              duration: 250,
              useNativeDriver: false,
            }).start();
            return next;
          });
          const nextDelay = Math.floor(Math.random() * 400) + 200;
          setTimeout(simulateProgress, nextDelay);
        };
        simulateProgress();
        const { analysisResult } = await analyzeGroup(groupId);
        isAnalysisComplete = true;
        animateProgress(100);

        // Print raw JSON response
        console.log("[Upload] ☁️ Raw Cloud Analysis Response (JSON):");
        console.log(JSON.stringify(analysisResult, null, 2));

        console.log("[Upload] ☁️ Cloud analysis complete");
        console.log(
          `  • Total fish: ${analysisResult.aggregateStats.totalFishCount}`,
        );
        console.log(`  • Images processed: ${analysisResult.images.length}`);

        // Normalize URLs to ensure gradcam and crop images load correctly
        const normalizedAnalysis = normalizeGroupAnalysisUrls(analysisResult);
        // Save to analysis store for detailed report page
        setAnalysisData({
          mode: "online",
          groupAnalysis: normalizedAnalysis,
          groupId,
          imageUris: [targetUri],
          location,
        });
        setGroupAnalysis(normalizedAnalysis);
        setUploadGroupId(groupId);
        setStep("done");
      } catch (e: any) {
        // ── Cloud failed → fallback to offline ──
        console.warn(`[Upload] ☁️ Cloud analysis failed: ${e.message}`);
        console.log("[Upload] 🔄 Falling back to offline inference…");

        try {
          setStep("processing");
          setAnalysisMode("offline");
          animateProgress(0);
          setOfflineStep("Starting on-device fallback…");

          const {
            detections: offlineDets,
            processingTime,
            errors,
          } = await runOfflineInference(targetUri, ({ percent, step }) => {
            animateProgress(percent);
            setOfflineStep(step);
          });

          setOfflineStep("");

          console.log(
            `[Upload] ✅ Offline fallback: ${offlineDets.length} fish in ${processingTime}ms`,
          );
          setOfflineResults(offlineDets);
          setOfflineProcessingTime(processingTime);

          // Save to analysis store for detailed report page
          setAnalysisData({
            mode: "offline",
            offlineResults: offlineDets,
            processingTime,
            imageUri: targetUri,
            location,
          });

          // Persist to local history and attach the record ID to the store
          saveLocalAnalysis({
            mode: "offline",
            offlineResults: offlineDets,
            processingTime,
            imageUri: targetUri,
            location,
          })
            .then((record) => {
              const current = getAnalysisData();
              if (current?.mode === "offline") {
                current.localRecordId = record.id;
              }
              // Push fresh counts to the sync indicator in the header.
              SyncService.refreshStatus();
            })
            .catch((e) =>
              console.warn("[Upload] Local history save failed:", e),
            );

          if (offlineDets.length > 0) {
            // Reconstruct boxes for overlay
            const imgDims = await new Promise<{ w: number; h: number }>(
              (resolve) => {
                Image.getSize(
                  targetUri!,
                  (w, h) => resolve({ w, h }),
                  () => resolve({ w: 1, h: 1 }),
                );
              },
            );
            const boxes: BoundingBox[] = offlineDets.map((d) => ({
              x1: d.bbox[0] / imgDims.w,
              y1: d.bbox[1] / imgDims.h,
              x2: d.bbox[2] / imgDims.w,
              y2: d.bbox[3] / imgDims.h,
              classId: 0,
              confidence: d.speciesConfidence,
            }));
            setDetections(boxes);
            setDetectionTime(processingTime);
            setCropUris(
              offlineDets.filter((d) => d.cropUri).map((d) => d.cropUri!),
            );
          } else {
            Alert.alert("No Fish Detected", "No fish detected in this image.");
          }

          animateProgress(100);
          setStep(offlineDets.length > 0 ? "done" : "error");
        } catch (fallbackErr: any) {
          console.error(
            "[Upload] ❌ Offline fallback also failed:",
            fallbackErr.message,
          );
          setStep("error");
          const cloudErrorMessage = e.message || t("common.error");
          const offlineErrorMessage = fallbackErr.message || t("common.error");
          Alert.alert(
            "Analysis Failed",
            `Cloud: ${cloudErrorMessage}\nOffline: ${offlineErrorMessage}\n\n${CACHE_HINT_MESSAGE}`,
          );
        }
      }
    }
  };

  const reset = () => {
    setImageUri(null);
    setImageUris([]);
    setResult(null);
    setGroupAnalysis(null);
    setUploadGroupId(null);
    setStep("idle");
    setProgress(0);
    setUploadProgress({});
    progressAnim.setValue(0);
    setLocation(null);
    setDetections([]);
    setCropUris([]);
    setDetectionTime(null);
    setIsDetecting(false);
    setOfflineResults([]);
    setOfflineProcessingTime(null);
    setAnalysisMode(null);
    setCurrentImageIndex(0);
    setForceOffline(false);
    setOfflineStep("");
  };

  const removeImage = (index: number) => {
    const newUris = imageUris.filter((_, i) => i !== index);
    setImageUris(newUris);
    if (newUris.length > 0) {
      setImageUri(newUris[0]);
      if (currentImageIndex >= newUris.length) {
        setCurrentImageIndex(newUris.length - 1);
      }
    } else {
      setImageUri(null);
      setCurrentImageIndex(0);
    }
  };

  const navigateImage = (direction: "prev" | "next") => {
    if (!groupAnalysis) return;
    const newIndex =
      direction === "prev"
        ? Math.max(0, currentImageIndex - 1)
        : Math.min(groupAnalysis.images.length - 1, currentImageIndex + 1);
    setCurrentImageIndex(newIndex);
  };

  const gradeColor =
    result?.qualityGrade === "Premium"
      ? COLORS.success
      : result?.qualityGrade === "Standard"
        ? COLORS.warning
        : COLORS.error;

  if (!isLoaded) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{t("upload.title")}</Text>
            <Text style={styles.subtitle}>{t("upload.subtitle")}</Text>
          </View>
          <ProfileMenu size={36} />
        </View>

        {/* Upload Zone */}
        {imageUris.length === 0 && !imageUri ? (
          <View style={styles.uploadZone}>
            <Ionicons
              name="camera-outline"
              size={36}
              color={COLORS.textMuted}
              style={{ marginBottom: SPACING.sm }}
            />
            <Text style={styles.uploadTitle}>{t("upload.cta")}</Text>
            <Text style={styles.uploadHint}>{t("upload.hint")}</Text>
            <View style={styles.uploadBtns}>
              <Button
                label={t("upload.btnCamera")}
                onPress={captureFromCamera}
                variant="primary"
                icon={<Ionicons name="camera" size={16} color="#fff" />}
                iconPosition="left"
                style={styles.uploadBtn}
              />
              <Button
                label={t("upload.btnGallery")}
                onPress={pickFromGallery}
                variant="outline"
                icon={
                  <Ionicons
                    name="images"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                }
                iconPosition="left"
                style={styles.uploadBtn}
              />
            </View>
            {/* Tips */}
            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>{t("upload.tipsTitle")}</Text>
              <Text style={styles.tipItem}>• {t("upload.tip1")}</Text>
              <Text style={styles.tipItem}>• {t("upload.tip2")}</Text>
              <Text style={styles.tipItem}>• {t("upload.tip3")}</Text>
              <Text style={styles.tipItem}>
                • Select multiple images for batch analysis
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Multi-Image Preview Grid */}
            {imageUris.length > 1 && (
              <Card style={styles.multiImageCard} padding={SPACING.md}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons
                    name="images-outline"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                  <Text style={styles.multiImageTitle}>
                    {imageUris.length} Images Selected
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.multiImageScroll}
                >
                  {imageUris.map((uri, idx) => (
                    <View key={idx} style={styles.multiImageItem}>
                      <Image
                        source={{ uri }}
                        style={styles.multiImageThumb}
                        resizeMode="cover"
                      />
                      {step === "idle" && (
                        <TouchableOpacity
                          style={styles.multiImageRemove}
                          onPress={() => removeImage(idx)}
                        >
                          <Text style={styles.multiImageRemoveText}>✕</Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.multiImageIndex}>#{idx + 1}</Text>
                      {step === "uploading" &&
                        uploadProgress[idx] !== undefined && (
                          <View style={styles.multiImageProgress}>
                            <View
                              style={[
                                styles.multiImageProgressFill,
                                { width: `${uploadProgress[idx]}%` },
                              ]}
                            />
                          </View>
                        )}
                    </View>
                  ))}
                </ScrollView>
              </Card>
            )}

            {/* Single Image Preview */}
            {imageUris.length === 1 && imageUri && (
              <View style={styles.previewCard}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                {location && (
                  <View style={styles.locationBadge}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.locationText}>
                        {location.lat.toFixed(3)}°N, {location.lng.toFixed(3)}
                        °E
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Progress */}
            {isAnalyzing && (
              <Card style={styles.progressCard} padding={SPACING.md}>
                <Text style={styles.progressLabel}>
                  {step === "uploading"
                    ? `${t("upload.uploading")}...`
                    : `${t("upload.analyzing")}...`}
                </Text>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
                {step === "processing" &&
                  (analysisMode === "offline" && offlineStep ? (
                    <View style={styles.offlineStepRow}>
                      <ActivityIndicator
                        size="small"
                        color={COLORS.primaryLight}
                        style={{ transform: [{ scale: 0.7 }] }}
                      />
                      <Text style={styles.progressHint}>{offlineStep}</Text>
                    </View>
                  ) : (
                    <Text style={styles.progressHint}>
                      {analysisMode === "offline"
                        ? "On-device: YOLOv8 → Species → Disease → GradCAM"
                        : "YOLOv11 → Species Classification → Weight Estimation"}
                    </Text>
                  ))}
              </Card>
            )}

            {/* Controls */}
            {step === "idle" && (
              <View>
                <Button
                  label={t("upload.btnStartAnalysis")}
                  onPress={startAnalysis}
                  size="lg"
                  fullWidth
                />
                <View style={styles.offlineToggleRow}>
                  <TouchableOpacity
                    style={styles.offlineToggle}
                    onPress={() => setForceOffline((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.offlineToggleBox,
                        forceOffline && styles.offlineToggleBoxOn,
                      ]}
                    >
                      {forceOffline && (
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      )}
                    </View>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={13}
                      color={
                        forceOffline ? COLORS.primaryLight : COLORS.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.offlineToggleText,
                        forceOffline && { color: COLORS.primaryLight },
                      ]}
                    >
                      Use on-device inference
                    </Text>
                  </TouchableOpacity>
                  <Button
                    label={t("common.cancel")}
                    onPress={reset}
                    variant="ghost"
                    size="sm"
                  />
                </View>
              </View>
            )}
            {step === "error" && (
              <View style={styles.controlRow}>
                <Button
                  label="Retry"
                  onPress={startAnalysis}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t("common.cancel")}
                  onPress={reset}
                  variant="outline"
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {step === "done" && (
              <Button
                label={t("upload.btnUploadAnother")}
                onPress={reset}
                variant="outline"
                fullWidth
                style={{ marginTop: SPACING.md }}
              />
            )}
          </>
        )}

        {isDetecting && (
          <Card style={styles.detectionCard} padding={SPACING.md}>
            <View style={styles.detectingRow}>
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text style={styles.detectingText}>
                Running on-device detection…
              </Text>
            </View>
          </Card>
        )}

        {detections.length > 0 && imageUri && (
          <View style={styles.detectionSection}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: SPACING.md,
              }}
            >
              <Ionicons
                name="scan-outline"
                size={16}
                color={COLORS.primaryLight}
              />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                Detection Results
              </Text>
            </View>
            <Card style={styles.detectionCard} padding={0}>
              <BoundingBoxOverlay
                imageUri={imageUri}
                detections={detections}
                containerWidth={SCREEN_WIDTH - SPACING.xl * 2}
                containerHeight={320}
              />
            </Card>
            {detectionTime !== null && (
              <Text style={styles.detectionMeta}>
                {detections.length} fish detected in {detectionTime}ms
                (on-device)
              </Text>
            )}

            {cropUris.length > 0 && (
              <View style={styles.cropsSection}>
                <Text style={styles.cropsTitle}>Detected Crops</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cropsRow}
                >
                  {cropUris.map((uri, idx) => (
                    <View key={`${uri}-${idx}`} style={styles.cropItem}>
                      <Image
                        source={{ uri }}
                        style={styles.cropImage}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* ═══ GROUP ANALYSIS RESULTS ═══ */}
        {groupAnalysis && (
          <View style={styles.groupSection}>
            {/* Agent Takeover Card */}
            <TouchableOpacity
              style={styles.agentTakeoverCard}
              onPress={() => {
                const prompt = `I just scanned ${groupAnalysis.aggregateStats.totalFishCount} fish across ${groupAnalysis.images.length} images. Species found: ${Object.keys(groupAnalysis.aggregateStats.speciesDistribution).join(", ")}. Total weight: ${groupAnalysis.aggregateStats.totalEstimatedWeight.toFixed(2)} kg, estimated value: ₹${groupAnalysis.aggregateStats.totalEstimatedValue}. ${groupAnalysis.aggregateStats.diseaseDetected ? "Some fish show signs of disease!" : "Fish appear healthy."} Please give me a detailed analysis with market recommendations.`;
                router.push({
                  pathname: "/(tabs)/chat",
                  params: { initialMessage: prompt },
                });
              }}
              activeOpacity={0.85}
            >
              <View style={styles.agentTakeoverIcon}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
              </View>
              <View style={styles.agentTakeoverContent}>
                <Text style={styles.agentTakeoverTitle}>
                  SagarMitra has insights for you
                </Text>
                <Text style={styles.agentTakeoverSub}>
                  Get market prices, disease analysis, and selling
                  recommendations
                </Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="rgba(255,255,255,0.7)"
              />
            </TouchableOpacity>

            {/* Aggregate Statistics Card */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: SPACING.md,
              }}
            >
              <Ionicons
                name="bar-chart"
                size={16}
                color={COLORS.primaryLight}
              />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                Group Analysis Summary
              </Text>
            </View>
            <Card style={styles.aggregateCard} padding={SPACING.xl}>
              <View style={styles.aggregateHeader}>
                <Text style={styles.aggregateTitle}>
                  {groupAnalysis.images.length} Images Analyzed
                </Text>
                <Text style={styles.aggregateTime}>
                  {new Date(groupAnalysis.processedAt).toLocaleTimeString()}
                </Text>
              </View>

              {/* Total Fish Count */}
              <View style={styles.aggregateRow}>
                <Text style={styles.aggregateLabel}>Total Fish Detected</Text>
                <Text style={styles.aggregateValue}>
                  {groupAnalysis.aggregateStats.totalFishCount}
                </Text>
              </View>

              {/* Average Confidence */}
              <View style={styles.aggregateRow}>
                <Text style={styles.aggregateLabel}>Average Confidence</Text>
                <Text style={styles.aggregateValue}>
                  {(
                    groupAnalysis.aggregateStats.averageConfidence * 100
                  ).toFixed(1)}
                  %
                </Text>
              </View>

              {/* Total Weight */}
              <View style={styles.aggregateRow}>
                <Text style={styles.aggregateLabel}>Total Weight</Text>
                <Text style={styles.aggregateValue}>
                  {groupAnalysis.aggregateStats.totalEstimatedWeight.toFixed(2)}{" "}
                  kg
                </Text>
              </View>

              {/* Total Value */}
              <View style={styles.aggregateRow}>
                <Text style={styles.aggregateLabel}>Total Value</Text>
                <Text style={styles.aggregateValue}>
                  ₹
                  {groupAnalysis.aggregateStats.totalEstimatedValue.toLocaleString(
                    "en-IN",
                  )}
                </Text>
              </View>

              {/* Disease Detection */}
              <View style={styles.aggregateRow}>
                <Text style={styles.aggregateLabel}>Disease Status</Text>
                <View
                  style={[
                    styles.diseaseStatusBadge,
                    {
                      backgroundColor: groupAnalysis.aggregateStats
                        .diseaseDetected
                        ? COLORS.warning + "20"
                        : COLORS.success + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.diseaseStatusText,
                      {
                        color: groupAnalysis.aggregateStats.diseaseDetected
                          ? COLORS.warning
                          : COLORS.success,
                      },
                    ]}
                  >
                    {groupAnalysis.aggregateStats.diseaseDetected
                      ? "Disease Detected"
                      : "All Healthy"}
                  </Text>
                </View>
              </View>

              {/* Species Distribution */}
              {Object.keys(groupAnalysis.aggregateStats.speciesDistribution)
                .length > 0 && (
                <View style={styles.speciesDistSection}>
                  <Text style={styles.speciesDistTitle}>Species Breakdown</Text>
                  {Object.entries(
                    groupAnalysis.aggregateStats.speciesDistribution,
                  )
                    .sort(([, a], [, b]) => b - a)
                    .map(([species, count]) => (
                      <View key={species} style={styles.speciesDistRow}>
                        <Text style={styles.speciesDistName}>
                          {translateFishName(species, locale)}
                        </Text>
                        <View style={styles.speciesDistRight}>
                          <Text style={styles.speciesDistCount}>{count}</Text>
                          <View style={styles.speciesDistBar}>
                            <View
                              style={[
                                styles.speciesDistBarFill,
                                {
                                  width: `${(count / groupAnalysis.aggregateStats.totalFishCount) * 100}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                </View>
              )}
            </Card>

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <Button
                label="View Detailed Report"
                onPress={() => router.push("/analysis/detail")}
                variant="primary"
                icon={<Ionicons name="document-text" size={16} color="#fff" />}
                iconPosition="left"
                style={styles.actionButton}
              />
              <Button
                label="Export PDF"
                onPress={async () => {
                  try {
                    const { exportAnalysisToPDF } =
                      await import("../../lib/pdf-export");
                    await exportAnalysisToPDF();
                  } catch (error) {
                    Alert.alert("Export Failed", "Could not export PDF");
                  }
                }}
                variant="outline"
                icon={
                  <Ionicons
                    name="download"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                }
                iconPosition="left"
                style={styles.actionButton}
              />
            </View>
            <Button
              label="Ask AI About This Catch"
              onPress={() => {
                const prompt = `I just analyzed a group of ${groupAnalysis.aggregateStats.totalFishCount} fish. Total weight: ${groupAnalysis.aggregateStats.totalEstimatedWeight.toFixed(2)} kg, Total value: ₹${groupAnalysis.aggregateStats.totalEstimatedValue}. Species: ${Object.keys(groupAnalysis.aggregateStats.speciesDistribution).join(", ")}. What are the current market prices and any recommendations?`;
                router.push({
                  pathname: "/(tabs)/chat",
                  params: { initialMessage: prompt },
                });
              }}
              variant="secondary"
              icon={<Ionicons name="chatbubbles" size={16} color="#fff" />}
              iconPosition="left"
              fullWidth
              style={{ marginBottom: SPACING.md }}
            />

            {/* Image Slider - Like Photo Gallery */}
            <ImageSlider
              images={imageUris.map((uri, idx) => ({
                uri,
                label: `Image ${idx + 1}`,
              }))}
              currentIndex={currentImageIndex}
              onIndexChange={setCurrentImageIndex}
              imageHeight={300}
              showIndicators={true}
            />

            {/* Results for Current Image */}
            {groupAnalysis.images[currentImageIndex] && (
              <View style={styles.currentImageSection}>
                {/* Error Message */}
                {groupAnalysis.images[currentImageIndex].error && (
                  <Card style={styles.errorCard} padding={SPACING.md}>
                    <Text style={styles.errorText}>
                      ⚠️ {groupAnalysis.images[currentImageIndex].error}
                    </Text>
                  </Card>
                )}

                {/* Crops for Current Image */}
                {Object.keys(groupAnalysis.images[currentImageIndex].crops)
                  .length > 0 ? (
                  <View style={styles.cropsSection}>
                    {(() => {
                      const allCrops = Object.entries(
                        groupAnalysis.images[currentImageIndex].crops,
                      );
                      const visibleCrops = allCrops.filter(
                        ([, c]) =>
                          c.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD,
                      );
                      const filteredCount =
                        allCrops.length - visibleCrops.length;
                      return (
                        <>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: SPACING.md,
                            }}
                          >
                            <Ionicons
                              name="fish-outline"
                              size={16}
                              color={COLORS.primaryLight}
                            />
                            <Text
                              style={[styles.sectionTitle, { marginBottom: 0 }]}
                            >
                              Detected Fish ({visibleCrops.length})
                            </Text>
                            {filteredCount > 0 && (
                              <Text
                                style={{
                                  color: COLORS.textMuted,
                                  fontSize: FONTS.sizes.sm,
                                }}
                              >
                                {" "}
                                · {filteredCount} below 30% confidence hidden
                              </Text>
                            )}
                          </View>
                          {visibleCrops.map(([cropKey, crop], cropIdx) => {
                            const supplement = generateMockSupplement(
                              crop.species.label,
                              cropIdx,
                            );
                            const diseaseColor =
                              crop.disease.label === "Healthy Fish"
                                ? COLORS.success
                                : COLORS.warning;
                            const translatedSpecies = translateFishName(
                              crop.species.label,
                              locale,
                            );
                            const translatedDisease = translateDiseaseName(
                              crop.disease.label,
                              locale,
                            );
                            const qualColor =
                              supplement.qualityGrade === "Premium"
                                ? COLORS.success
                                : supplement.qualityGrade === "Standard"
                                  ? COLORS.warning
                                  : COLORS.error;

                            return (
                              <Card
                                key={cropKey}
                                style={styles.cropCard}
                                padding={SPACING.md}
                              >
                                {/* Header */}
                                <View style={styles.cropCardHeader}>
                                  <Text style={styles.cropCardTitle}>
                                    Fish #{cropIdx + 1}
                                  </Text>
                                  <View
                                    style={[
                                      styles.cropConfBadge,
                                      {
                                        backgroundColor:
                                          COLORS.primaryLight + "20",
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.cropConfText,
                                        { color: COLORS.primaryLight },
                                      ]}
                                    >
                                      {(crop.yolo_confidence * 100).toFixed(1)}%
                                      YOLO
                                    </Text>
                                  </View>
                                </View>

                                {/* Species */}
                                <Text style={styles.cropSpecies}>
                                  {translatedSpecies}
                                </Text>
                                <Text style={styles.cropScientific}>
                                  {supplement.scientificName}
                                </Text>

                                {/* Disease */}
                                <View style={styles.cropRow}>
                                  <Text style={styles.cropLabel}>Health:</Text>
                                  <Text
                                    style={[
                                      styles.cropValue,
                                      { color: diseaseColor },
                                    ]}
                                  >
                                    {translatedDisease}
                                  </Text>
                                </View>

                                {/* Quality */}
                                <View style={styles.cropRow}>
                                  <Text style={styles.cropLabel}>Quality:</Text>
                                  <Text
                                    style={[
                                      styles.cropValue,
                                      { color: qualColor },
                                    ]}
                                  >
                                    {supplement.qualityGrade}
                                  </Text>
                                </View>

                                {/* Measurements */}
                                <View style={styles.cropMetrics}>
                                  <View style={styles.cropMetricItem}>
                                    <Text style={styles.cropMetricVal}>
                                      {supplement.weight_kg.toFixed(2)} kg
                                    </Text>
                                    <Text style={styles.cropMetricLabel}>
                                      Weight
                                    </Text>
                                  </View>
                                  <View style={styles.cropMetricItem}>
                                    <Text style={styles.cropMetricVal}>
                                      {supplement.length_mm} mm
                                    </Text>
                                    <Text style={styles.cropMetricLabel}>
                                      Length
                                    </Text>
                                  </View>
                                  <View style={styles.cropMetricItem}>
                                    <Text style={styles.cropMetricVal}>
                                      ₹{supplement.estimatedValue}
                                    </Text>
                                    <Text style={styles.cropMetricLabel}>
                                      Value
                                    </Text>
                                  </View>
                                </View>

                                {/* Legal size */}
                                <View
                                  style={[
                                    styles.cropRow,
                                    { marginBottom: SPACING.sm },
                                  ]}
                                >
                                  <Text style={styles.cropLabel}>
                                    Legal Size:
                                  </Text>
                                  <Text
                                    style={[
                                      styles.cropValue,
                                      {
                                        color: supplement.isSustainable
                                          ? COLORS.success
                                          : COLORS.error,
                                      },
                                    ]}
                                  >
                                    {supplement.isSustainable
                                      ? "Legal"
                                      : "Below Limit"}
                                  </Text>
                                </View>

                                {/* Detailed Report Button */}
                                <Button
                                  label="View Detailed Report →"
                                  onPress={() =>
                                    router.push("/analysis/detail")
                                  }
                                  variant="outline"
                                  size="sm"
                                  fullWidth
                                />
                              </Card>
                            );
                          })}
                        </>
                      );
                    })()}
                  </View>
                ) : (
                  !groupAnalysis.images[currentImageIndex].error && (
                    <Card style={styles.noFishCard} padding={SPACING.xl}>
                      <Text style={styles.noFishText}>
                        🔍 No fish detected in this image
                      </Text>
                    </Card>
                  )
                )}
              </View>
            )}
          </View>
        )}

        {/* ═══ Offline Analysis Summary ═══ */}
        {offlineResults.length > 0 &&
          (() => {
            const totalFish = offlineResults.length;
            const avgConf =
              offlineResults.reduce((s, d) => s + d.speciesConfidence, 0) /
              totalFish;
            // Sum the weight of all detected fish (either bbox-estimated or user-entered)
            const hasUserWeights = offlineResults.some(d => d.weightG > 0);
            const totalWeightKg =
              offlineResults.reduce((s, d) => s + d.weightG, 0) / 1000;
            // Prices are unavailable in offline mode - never show estimated value.
            const anyDisease = offlineResults.some(
              (d) => d.disease !== "Healthy Fish",
            );
            const speciesDist = offlineResults.reduce<Record<string, number>>(
              (acc, d) => {
                acc[d.species] = (acc[d.species] || 0) + 1;
                return acc;
              },
              {},
            );
            return (
              <View style={styles.groupSection}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: SPACING.md,
                  }}
                >
                  <Ionicons
                    name="bar-chart"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                    Offline Analysis Summary
                  </Text>
                </View>
                <Card style={styles.aggregateCard} padding={SPACING.xl}>
                  <View style={styles.offlineAggregateHeader}>
                    <View style={styles.offlineAggregateTitleBlock}>
                      <Text style={styles.offlineAggregateTitle}>
                        {totalFish} Fish Detected
                      </Text>
                      <Text style={styles.offlineAggregateSubtitle}>
                        On-device inference
                      </Text>
                    </View>
                    {offlineProcessingTime !== null && (
                      <View style={styles.offlineAggregateTimeBadge}>
                        <Text style={styles.offlineAggregateTime}>
                          {offlineProcessingTime}ms
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.aggregateRow}>
                    <Text style={styles.aggregateLabel}>Total Fish</Text>
                    <Text style={styles.aggregateValue}>{totalFish}</Text>
                  </View>

                  <View style={styles.aggregateRow}>
                    <Text style={styles.aggregateLabel}>Avg Confidence</Text>
                    <Text style={styles.aggregateValue}>
                      {(avgConf * 100).toFixed(1)}%
                    </Text>
                  </View>

                  {hasUserWeights && (
                    <View style={styles.aggregateRow}>
                      <Text style={styles.aggregateLabel}>Total Weight</Text>
                      <Text style={styles.aggregateValue}>
                        {totalWeightKg.toFixed(2)} kg
                      </Text>
                    </View>
                  )}

                  {/* Total Value is hidden in offline mode - market prices require connectivity */}

                  <View style={styles.aggregateRow}>
                    <Text style={styles.aggregateLabel}>Disease Status</Text>
                    <View
                      style={[
                        styles.diseaseStatusBadge,
                        {
                          backgroundColor: anyDisease
                            ? COLORS.warning + "20"
                            : COLORS.success + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.diseaseStatusText,
                          {
                            color: anyDisease ? COLORS.warning : COLORS.success,
                          },
                        ]}
                      >
                        {anyDisease ? "Disease Detected" : "All Healthy"}
                      </Text>
                    </View>
                  </View>

                  {Object.keys(speciesDist).length > 0 && (
                    <View style={styles.speciesDistSection}>
                      <Text style={styles.speciesDistTitle}>
                        Species Breakdown
                      </Text>
                      {Object.entries(speciesDist)
                        .sort(([, a], [, b]) => b - a)
                        .map(([species, count]) => (
                          <View key={species} style={styles.speciesDistRow}>
                            <Text style={styles.speciesDistName}>
                              {translateFishName(species, locale)}
                            </Text>
                            <View style={styles.speciesDistRight}>
                              <Text style={styles.speciesDistCount}>
                                {count}
                              </Text>
                              <View style={styles.speciesDistBar}>
                                <View
                                  style={[
                                    styles.speciesDistBarFill,
                                    { width: `${(count / totalFish) * 100}%` },
                                  ]}
                                />
                              </View>
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                </Card>

                {/* Action Buttons */}
                <View style={styles.actionButtonsRow}>
                  <Button
                    label="View Detailed Report"
                    onPress={() => router.push("/analysis/detail")}
                    variant="primary"
                    icon={
                      <Ionicons name="document-text" size={16} color="#fff" />
                    }
                    iconPosition="left"
                    style={styles.actionButton}
                  />
                  <Button
                    label="Export PDF"
                    onPress={async () => {
                      try {
                        const { exportAnalysisToPDF } =
                          await import("../../lib/pdf-export");
                        await exportAnalysisToPDF();
                      } catch (error) {
                        Alert.alert("Export Failed", "Could not export PDF");
                      }
                    }}
                    variant="outline"
                    icon={
                      <Ionicons
                        name="download"
                        size={16}
                        color={COLORS.primaryLight}
                      />
                    }
                    iconPosition="left"
                    style={styles.actionButton}
                  />
                </View>
              </View>
            );
          })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING["3xl"] },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  uploadZone: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    padding: SPACING.xl,
    alignItems: "center",
    marginBottom: SPACING.lg,
  },

  uploadTitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.xs,
  },
  uploadHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  uploadBtns: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  uploadBtn: { minWidth: 130 },

  tipsBox: {
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: "100%",
  },
  tipsTitle: {
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.xs,
  },
  tipItem: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    lineHeight: 22,
  },

  previewCard: {
    borderRadius: RADIUS["2xl"],
    overflow: "hidden",
    marginBottom: SPACING.md,
    position: "relative",
  },
  previewImage: { width: "100%", height: 280 },
  locationBadge: {
    position: "absolute",
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  locationText: {
    color: "#fff",
    fontSize: FONTS.sizes.xs,
    fontFamily: "monospace",
  },

  progressCard: { marginBottom: SPACING.md },
  progressLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.medium,
    marginBottom: SPACING.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  progressHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    fontStyle: "italic",
    textAlign: "center",
  },
  offlineStepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: SPACING.xs,
  },

  controlRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  analyzeBtn: { flex: 1 },
  removeBtn: { minWidth: 90 },

  offlineToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  offlineToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  offlineToggleBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineToggleBoxOn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  offlineToggleText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },

  resultsSection: { marginTop: SPACING.sm },
  sectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  resultCard: { marginBottom: SPACING.md },
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: SPACING.sm,
  },
  statusChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    maxWidth: "75%",
  },
  statusChipText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  speciesLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
  },
  speciesName: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.xs,
    flexShrink: 1,
    maxWidth: "100%",
  },
  scientificName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontStyle: "italic",
    marginBottom: SPACING.md,
    flexShrink: 1,
    maxWidth: "100%",
  },
  confidenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confidenceLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  confidenceValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },

  metricsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  metricCard: { flex: 1 },

  metricLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  metricValue: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.extrabold,
  },
  metricSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    marginTop: SPACING.xs,
  },

  marketCard: { marginBottom: SPACING.md },
  marketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  marketPrimaryBlock: { flexShrink: 1, minWidth: 170, maxWidth: "100%" },
  marketSecondaryBlock: { marginLeft: "auto", minWidth: 120, maxWidth: "100%" },
  marketLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  marketValue: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.extrabold,
    flexShrink: 1,
  },
  marketRate: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  legalLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "right",
    marginBottom: SPACING.xs,
  },
  legalBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  legalText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

  sustainCard: {
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  sustainText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  modelStatusCard: { marginBottom: SPACING.md },
  modelStatusTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.xs,
  },
  modelStatusPath: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontFamily: "monospace",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  modelRowLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  modelActionsRow: { marginTop: SPACING.md, flexDirection: "row" },
  reloadButton: { minWidth: 150 },
  modelStatusError: {
    color: COLORS.warning,
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.sm,
  },

  // Detection styles
  detectionSection: { marginTop: SPACING.sm, marginBottom: SPACING.md },
  detectionCard: {
    marginBottom: SPACING.sm,
    overflow: "hidden",
    borderRadius: RADIUS.xl,
  },
  detectingRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  detectingText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
  cropsSection: { marginTop: SPACING.sm },
  cropsTitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.sm,
    fontWeight: FONTS.weights.semibold,
  },
  cropsRow: { gap: SPACING.sm, paddingRight: SPACING.sm },
  cropItem: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  cropImage: { width: "100%", height: "100%" },
  detectionMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
    fontFamily: "monospace",
    marginTop: SPACING.xs,
  },

  // ── Offline per-fish result styles ──
  offlineSection: { marginTop: SPACING.xl },
  fishCard: { marginBottom: SPACING.md },
  fishCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  fishCardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  fishConfBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  fishConfText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  fishSpecies: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.primaryLight,
    marginBottom: SPACING.sm,
  },
  fishRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fishLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  fishValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  fishMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
  },
  fishMetricItem: { alignItems: "center" },
  fishMetricVal: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  fishMetricLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  fishImages: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  fishImgBox: {
    flex: 1,
    alignItems: "center",
  },
  fishImg: {
    width: "100%",
    height: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fishImgLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  fishError: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    marginTop: SPACING.sm,
    fontStyle: "italic",
  },
  modeBadge: {
    alignItems: "center",
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  modeBadgeSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: "monospace",
  },

  // ── Multi-image preview styles ──
  multiImageCard: {
    marginBottom: SPACING.md,
  },
  multiImageTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  multiImageScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  multiImageItem: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    position: "relative",
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  multiImageThumb: {
    width: "100%",
    height: "100%",
  },
  multiImageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  multiImageRemoveText: {
    color: "#fff",
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  multiImageIndex: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    fontSize: FONTS.sizes.xs,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    fontWeight: FONTS.weights.bold,
  },
  multiImageProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  multiImageProgressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
  },

  // ── Group analysis styles ──
  groupSection: {
    marginTop: SPACING.xl,
  },
  agentTakeoverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: 12,
    overflow: "hidden",
  },
  agentTakeoverIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  agentTakeoverContent: {
    flex: 1,
  },
  agentTakeoverTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: "#fff",
    marginBottom: 2,
  },
  agentTakeoverSub: {
    fontSize: FONTS.sizes.xs,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 16,
  },
  aggregateCard: {
    marginBottom: SPACING.md,
  },
  offlineAggregateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  offlineAggregateTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  offlineAggregateTitle: {
    fontSize: FONTS.sizes["2xl"],
    lineHeight: 32,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  offlineAggregateSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  offlineAggregateTimeBadge: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignSelf: "flex-start",
  },
  offlineAggregateTime: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
  },
  aggregateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  aggregateTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  aggregateTime: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  aggregateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  aggregateLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  aggregateValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  diseaseStatusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  diseaseStatusText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  speciesDistSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  speciesDistTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  speciesDistRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  speciesDistName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.sm,
  },
  speciesDistRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  speciesDistCount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    minWidth: 30,
    textAlign: "right",
  },
  speciesDistBar: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  speciesDistBarFill: {
    height: "100%",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
  },

  // ── Image navigation styles ──
  imageNavSection: {
    marginBottom: SPACING.md,
  },
  imageNavControls: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },

  // ── Current image results styles ──
  currentImageSection: {
    marginTop: SPACING.sm,
  },
  currentImageCard: {
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  currentImagePreview: {
    width: "100%",
    height: 280,
  },
  errorCard: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.error + "10",
    borderWidth: 1,
    borderColor: COLORS.error + "40",
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
    textAlign: "center",
  },
  noFishCard: {
    marginTop: SPACING.md,
    alignItems: "center",
  },
  noFishText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMuted,
    textAlign: "center",
  },

  // ── Crop card styles (for group analysis) ──
  cropCard: {
    marginBottom: SPACING.md,
  },
  cropCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  cropCardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  cropConfBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  cropConfText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  cropSpecies: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.primaryLight,
    marginBottom: 2,
  },
  cropScientific: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontStyle: "italic",
    marginBottom: SPACING.sm,
  },
  cropRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cropLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  cropValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  cropMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
  },
  cropMetricItem: {
    alignItems: "center",
  },
  cropMetricVal: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  cropMetricLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cropImages: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    flexWrap: "wrap",
  },
  cropImgBox: {
    flex: 1,
    minWidth: 100,
    alignItems: "center",
  },
  cropImg: {
    width: "100%",
    height: 100,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cropImgLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  cropYoloConf: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: "center",
    fontFamily: "monospace",
  },

  // Action buttons
  actionButtonsRow: {
    flexDirection: IS_COMPACT_SCREEN ? "column" : "row",
    alignItems: "stretch",
    gap: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  actionButton: {
    ...(IS_COMPACT_SCREEN ? { width: "100%" } : { flex: 1 }),
  },
});
