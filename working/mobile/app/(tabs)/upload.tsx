import React, { useState, useRef, useEffect } from "react";

import {
  View,
  Text,
  
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
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { setAnalysisData } from "../../lib/analysis-store";
import { toastService } from "../../lib/toast-service";
import { saveLocalAnalysis } from "../../lib/local-history";
import { WeightEstimateModal } from "../../components/WeightEstimateModal";
import { ProfileMenu } from "../../components/ui/ProfileMenu";

const YOLO_CONFIDENCE_THRESHOLD = 0.3;
const SCREEN_WIDTH = Dimensions.get("window").width;

type Step = "idle" | "uploading" | "processing" | "done" | "error";

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
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
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

  // ── Weight estimation state ──
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightSpecies, setWeightSpecies] = useState("Tilapia");
  const [weightFishIndex, setWeightFishIndex] = useState(0);
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

  // Preload all models on mount
  useEffect(() => {
    // TFLite detection model
    loadModel()
      .then(() => refreshModelStatus())
      .catch(() => {
        setModelError(true);
        setModelSource("missing");
        toastService.error(
          "Detection model failed to load. Please restart the app.",
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
          "Species/disease models failed to load. Please restart the app.",
        );
      })
      .finally(() => setTfliteLoading(false));
  }, []);

  // Trigger weight modal after species detection
  useEffect(() => {
    if (step === "done" && groupAnalysis) {
      // Check if we have species detected
      const firstDetection = groupAnalysis.detections?.[0];

      if (firstDetection?.species) {
        setWeightSpecies(firstDetection.species);
        setWeightFishIndex(0);
        // Small delay to let the UI settle
        setTimeout(() => {
          setWeightModalVisible(true);
        }, 500);
      }
    }
  }, [step, groupAnalysis]);

  // Synchronise offline weight updates when coming back from detailed analysis
  useFocusEffect(
    React.useCallback(() => {
      async function syncOfflineWeights() {
        if (!offlineResults.length || !imageUri) return;
        let needsUpdate = false;
        const newResults = [...offlineResults];
        
        for (let i = 0; i < newResults.length; i++) {
          const storageKey = `weight_estimate::${imageUri}::${i}`;
          const val = await AsyncStorage.getItem(storageKey);
          if (val !== null) {
            const weightG = parseFloat(val);
            if (newResults[i].weightG !== weightG) {
              newResults[i].weightG = weightG;
              needsUpdate = true;
            }
          }
        }
        
        if (needsUpdate) {
          setOfflineResults(newResults);
        }
      }
      syncOfflineWeights();
    }, [offlineResults, imageUri])
  );

  useFocusEffect(
    React.useCallback(() => {
      async function syncOnlineWeights() {
        if (!groupAnalysis || !imageUris.length) return;
        let needsUpdate = false;
        let totalWeightG = 0;

        let globalFishIndex = 0;
        for (let i = 0; i < groupAnalysis.images.length; i++) {
          const img = groupAnalysis.images[i];
          const crops = Object.entries(img.crops).filter(
            ([, c]) => c.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD
          );
          
          for (let j = 0; j < crops.length; j++) {
            const [, crop] = crops[j];
            const storageKey = `weight_estimate::${uploadGroupId || imageUris[i]}::${globalFishIndex}`;
            const val = await AsyncStorage.getItem(storageKey);
            
            // If the user estimated the weight, use it. Else fallback to supplement mock.
            if (val !== null) {
              totalWeightG += parseFloat(val);
              needsUpdate = true;
            } else {
              // fallback to mock supplement if not overridden
              const supplement = generateMockSupplement(crop.species.label, globalFishIndex);
              totalWeightG += supplement.weight_kg * 1000;
            }
            globalFishIndex++;
          }
        }
        
        if (needsUpdate && Math.abs(totalWeightG / 1000 - groupAnalysis.aggregateStats.totalEstimatedWeight) > 0.01) {
          const newGroupAnalysis = { ...groupAnalysis };
          newGroupAnalysis.aggregateStats = {
            ...newGroupAnalysis.aggregateStats,
            totalEstimatedWeight: totalWeightG / 1000,
          };
          setGroupAnalysis(newGroupAnalysis);
        }
      }
      syncOnlineWeights();
    }, [groupAnalysis, imageUris, uploadGroupId])
  );

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

        // Persist locally for offline history (queued for backend sync)
        let localRecordId: string | undefined;
        try {
          const record = await saveLocalAnalysis({
            mode: "offline",
            offlineResults: offlineDets,
            processingTime,
            imageUri: targetUri,
            location,
          });
          localRecordId = record.id;
        } catch (e) {
          console.warn("[Upload] Local history save failed:", e);
        }

        // Save to analysis store for detailed report page
        setAnalysisData({
          mode: "offline",
          offlineResults: offlineDets,
          processingTime,
          imageUri: targetUri,
          location,
          localRecordId,
        });

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
        Alert.alert("Offline Analysis Failed", e.message || t("common.error"));
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
        const interval = setInterval(() => {
          setProgress((prev) => {
            const next = Math.min(prev + 8, 85);
            Animated.timing(progressAnim, {
              toValue: next,
              duration: 250,
              useNativeDriver: false,
            }).start();
            return next;
          });
        }, 400);

        const { analysisResult } = await analyzeGroup(groupId);
        clearInterval(interval);
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
        const interval = setInterval(() => {
          setProgress((prev) => {
            const next = Math.min(prev + 12, 85);
            Animated.timing(progressAnim, {
              toValue: next,
              duration: 250,
              useNativeDriver: false,
            }).start();
            return next;
          });
        }, 300);
        const { analysisResult } = await analyzeGroup(groupId);
        clearInterval(interval);
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
          Alert.alert(
            "Analysis Failed",
            `Cloud: ${e.message}\nOffline: ${fallbackErr.message}`,
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

  // Weight modal handlers
  const handleWeightComplete = (weightG: number) => {
    setWeightModalVisible(false);

    // Navigate to chat with analysis context
    const firstImage = groupAnalysis?.images?.[0];
    const firstDetection = groupAnalysis?.detections?.[0];
    const imageUrl =
      firstImage?.yolo_image_url || imageUris[0] || imageUri || "";

    router.push({
      pathname: "/(tabs)/chat",
      params: {
        analysisId: uploadGroupId || "unknown",
        species: firstDetection?.species || weightSpecies,
        imageUrl,
        weight: weightG.toString(),
      },
    });
  };

  const handleWeightCancel = () => {
    setWeightModalVisible(false);

    // Navigate to chat without weight
    const firstImage = groupAnalysis?.images?.[0];
    const firstDetection = groupAnalysis?.detections?.[0];
    const imageUrl =
      firstImage?.yolo_image_url || imageUris[0] || imageUri || "";

    router.push({
      pathname: "/(tabs)/chat",
      params: {
        analysisId: uploadGroupId || "unknown",
        species: firstDetection?.species || weightSpecies,
        imageUrl,
      },
    });
  };

  if (!isLoaded) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-lg pb-3xl"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-lg flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-xl text-textPrimary font-bold">{t("upload.title")}</Text>
            <Text className="text-sm text-textMuted mt-xs">{t("upload.subtitle")}</Text>
          </View>
          <ProfileMenu size={36} />
        </View>

        {/* Upload Zone */}
        {imageUris.length === 0 && !imageUri ? (
          <View className="bg-bgCard rounded-xl border-[1.5px] border-borderDark border-dashed p-xl items-center mb-lg">
            <Ionicons
              name="camera-outline"
              size={36}
              color={COLORS.textMuted}
              style={{ marginBottom: SPACING.sm }}
            />
            <Text className="text-lg text-textPrimary font-semibold mb-xs">{t("upload.cta")}</Text>
            <Text className="text-sm text-textMuted text-center mb-lg px-lg">{t("upload.hint")}</Text>
            <View className="flex-row gap-sm mb-lg">
              <Button
                label={t("upload.btnCamera")}
                onPress={captureFromCamera}
                variant="primary"
                icon={<Ionicons name="camera" size={16} color="#fff" />}
                iconPosition="left"
                className="min-w-[130px]"
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
                className="min-w-[130px]"
              />
            </View>
            {/* Tips */}
            <View className="bg-bgDark rounded-lg p-md w-full">
              <Text className="text-primaryLight font-bold text-sm mb-xs">{t("upload.tipsTitle")}</Text>
              <Text className="text-textMuted text-sm leading-[22px]">• {t("upload.tip1")}</Text>
              <Text className="text-textMuted text-sm leading-[22px]">• {t("upload.tip2")}</Text>
              <Text className="text-textMuted text-sm leading-[22px]">• {t("upload.tip3")}</Text>
              <Text className="text-textMuted text-sm leading-[22px]">
                • Select multiple images for batch analysis
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Multi-Image Preview Grid */}
            {imageUris.length > 1 && (
              <Card className="mb-md" padding={SPACING.md}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons
                    name="images-outline"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                  <Text className="text-md font-bold text-textPrimary mb-sm">
                    {imageUris.length} Images Selected
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-sm pr-sm"
                >
                  {imageUris.map((uri, idx) => (
                    <View key={idx} className="w-[100px] h-[100px] rounded-md overflow-hidden relative border-2 border-borderDark">
                      <Image
                        source={{ uri }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                      {step === "idle" && (
                        <TouchableOpacity
                          className="absolute top-[4px] right-[4px] bg-error rounded-full w-[24px] h-[24px] items-center justify-center"
                          onPress={() => removeImage(idx)}
                        >
                          <Text className="text-white text-sm font-bold">✕</Text>
                        </TouchableOpacity>
                      )}
                      <Text className="absolute bottom-[4px] left-[4px] bg-black/70 text-white text-xs px-xs py-[2px] rounded-sm font-bold">#{idx + 1}</Text>
                      {step === "uploading" &&
                        uploadProgress[idx] !== undefined && (
                          <View className="absolute bottom-0 left-0 right-0 h-[4px] bg-black/30">
                            <View
                              className="h-full bg-primary" style={{ width: `${uploadProgress[idx]}%` }}
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
              <View className="rounded-2xl overflow-hidden mb-md relative">
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-[280px]"
                  resizeMode="cover"
                />
                {location && (
                  <View className="absolute top-md left-md bg-black/70 rounded-full px-md py-xs">
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
                      <Text className="text-white text-xs font-mono">
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
              <Card className="mb-md" padding={SPACING.md}>
                <Text className="text-sm text-textPrimary font-medium mb-sm">
                  {step === "uploading"
                    ? `${t("upload.uploading")}...`
                    : `${t("upload.analyzing")}...`}
                </Text>
                <View className="h-2 bg-borderDark rounded-full overflow-hidden">
                  <Animated.View
                    className="h-full bg-primary rounded-full" style={{
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                      }}
                  />
                </View>
                {step === "processing" &&
                  (analysisMode === "offline" && offlineStep ? (
                    <View className="flex-row items-center justify-center gap-[5px] mt-xs">
                      <ActivityIndicator
                        size="small"
                        color={COLORS.primaryLight}
                        style={{ transform: [{ scale: 0.7 }] }}
                      />
                      <Text className="text-xs text-textMuted mt-xs italic text-center">{offlineStep}</Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-textMuted mt-xs italic text-center">
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
                <View className="flex-row items-center justify-between mt-xs mb-sm">
                  <TouchableOpacity
                    className="flex-row items-center gap-[5px]"
                    onPress={() => setForceOffline((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <View
                      className={`w-[14px] h-[14px] rounded-[3px] border-[1.5px] border-textMuted items-center justify-center ${forceOffline ? "border-primary bg-primary" : ""}`}
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
                      className="text-xs text-textMuted"
                      style={forceOffline ? { color: COLORS.primaryLight } : undefined}
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
              <View className="flex-row gap-md mb-md">
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
          <Card className="mb-sm overflow-hidden rounded-xl" padding={SPACING.md}>
            <View className="flex-row items-center gap-sm">
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text className="text-textMuted text-sm">
                Running on-device detection…
              </Text>
            </View>
          </Card>
        )}

        {detections.length > 0 && imageUri && (
          <View className="mt-sm mb-md">
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
              <Text className="text-base font-semibold text-textPrimary mb-sm" style={{ marginBottom: 0 }}>
                Detection Results
              </Text>
            </View>
            <Card className="mb-sm overflow-hidden rounded-xl" padding={0}>
              <BoundingBoxOverlay
                imageUri={imageUri}
                detections={detections}
                containerWidth={SCREEN_WIDTH - SPACING.xl * 2}
                containerHeight={320}
              />
            </Card>
            {detectionTime !== null && (
              <Text className="text-xs text-textMuted text-center font-mono mt-xs">
                {detections.length} fish detected in {detectionTime}ms
                (on-device)
              </Text>
            )}

            {cropUris.length > 0 && (
              <View className="mt-sm">
                <Text className="text-textSecondary text-sm mb-sm font-semibold">Detected Crops</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-sm pr-sm"
                >
                  {cropUris.map((uri, idx) => (
                    <View key={`${uri}-${idx}`} className="w-[100px] h-[100px] rounded-md overflow-hidden border border-borderDark bg-bgCard">
                      <Image
                        source={{ uri }}
                        className="w-full h-full"
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
          <View className="mt-xl">
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
              <Text className="text-base font-semibold text-textPrimary mb-sm" style={{ marginBottom: 0 }}>
                Group Analysis Summary
              </Text>
            </View>
            <Card className="mb-md" padding={SPACING.xl}>
              <View className="flex-row justify-between items-center mb-md pb-sm border-b border-borderDark">
                <Text className="flex-1 text-lg font-bold text-primaryLight mr-sm">
                  {groupAnalysis.images.length} Images Analyzed
                </Text>
                <Text className="text-xs text-textMuted">
                  {new Date(groupAnalysis.processedAt).toLocaleTimeString()}
                </Text>
              </View>

              {/* Total Fish Count */}
              <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                <Text className="text-sm text-textSecondary font-medium">Total Fish Detected</Text>
                <Text className="text-lg font-bold text-textPrimary">
                  {groupAnalysis.aggregateStats.totalFishCount}
                </Text>
              </View>

              {/* Average Confidence */}
              <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                <Text className="text-sm text-textSecondary font-medium">Average Confidence</Text>
                <Text className="text-lg font-bold text-textPrimary">
                  {(
                    groupAnalysis.aggregateStats.averageConfidence * 100
                  ).toFixed(1)}
                  %
                </Text>
              </View>

              {/* Total Weight */}
              <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                <Text className="text-sm text-textSecondary font-medium">Total Weight</Text>
                <Text className="text-lg font-bold text-textPrimary">
                  {groupAnalysis.aggregateStats.totalEstimatedWeight.toFixed(2)}{" "}
                  kg
                </Text>
              </View>

              {/* Total Value */}
              <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                <Text className="text-sm text-textSecondary font-medium">Total Value</Text>
                <Text className="text-lg font-bold text-textPrimary">
                  ₹
                  {groupAnalysis.aggregateStats.totalEstimatedValue.toLocaleString(
                    "en-IN",
                  )}
                </Text>
              </View>

              {/* Disease Detection */}
              <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                <Text className="text-sm text-textSecondary font-medium">Disease Status</Text>
                <View
                  className="rounded-full px-sm py-[4px]" style={{
                      backgroundColor: groupAnalysis.aggregateStats
                        .diseaseDetected
                        ? COLORS.warning + "20"
                        : COLORS.success + "20",
                    }}
                >
                  <Text
                    className="text-sm font-bold" style={{
                        color: groupAnalysis.aggregateStats.diseaseDetected
                          ? COLORS.warning
                          : COLORS.success,
                      }}
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
                <View className="mt-md pt-md border-t border-borderDark">
                  <Text className="text-sm font-bold text-textPrimary mb-sm">Species Breakdown</Text>
                  {Object.entries(
                    groupAnalysis.aggregateStats.speciesDistribution,
                  )
                    .sort(([, a], [, b]) => b - a)
                    .map(([species, count]) => (
                      <View key={species} className="flex-row justify-between items-center mb-sm">
                        <Text className="text-sm text-textSecondary flex-1">
                          {translateFishName(species, locale)}
                        </Text>
                        <View className="flex-row items-center gap-sm flex-1">
                          <Text className="text-sm font-bold text-textPrimary min-w-[30px] text-right">{count}</Text>
                          <View className="flex-1 h-[8px] bg-borderDark rounded-full overflow-hidden">
                            <View
                              className="h-full bg-primaryLight rounded-full" style={{
                                  width: `${(count / groupAnalysis.aggregateStats.totalFishCount) * 100}%`,
                                }}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                </View>
              )}
            </Card>

            {/* Action Buttons */}
            <View className="flex-row gap-md mt-md mb-md">
              <Button
                label="View Detailed Report"
                onPress={() => router.push("/analysis/detail")}
                variant="primary"
                icon={<Ionicons name="document-text" size={16} color="#fff" />}
                iconPosition="left"
                className="flex-1"
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
                className="flex-1"
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
              <View className="mt-sm">
                {/* Error Message */}
                {groupAnalysis.images[currentImageIndex].error && (
                  <Card className="mb-md bg-error/10 border border-error/40" padding={SPACING.md}>
                    <Text className="text-sm text-error text-center">
                      ⚠️ {groupAnalysis.images[currentImageIndex].error}
                    </Text>
                  </Card>
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
            const totalWeightKg =
              offlineResults.reduce((s, d) => s + d.weightG, 0) / 1000;
            const totalValue = offlineResults.reduce(
              (s, d) => s + d.estimatedValue,
              0,
            );
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
              <View className="mt-xl">
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
                  <Text className="text-base font-semibold text-textPrimary mb-sm" style={{ marginBottom: 0 }}>
                    Offline Analysis Summary
                  </Text>
                </View>
                <Card className="mb-md" padding={SPACING.xl}>
                  <View className="flex-row justify-between items-center mb-md pb-sm border-b border-borderDark">
                    <Text className="flex-1 text-lg font-bold text-primaryLight mr-sm">
                      {totalFish} Fish Detected (On-Device)
                    </Text>
                    {offlineProcessingTime !== null && (
                      <Text className="text-xs text-textMuted">
                        {offlineProcessingTime}ms
                      </Text>
                    )}
                  </View>

                  <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                    <Text className="text-sm text-textSecondary font-medium">Total Fish</Text>
                    <Text className="text-lg font-bold text-textPrimary">{totalFish}</Text>
                  </View>

                  <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                    <Text className="text-sm text-textSecondary font-medium">Avg Confidence</Text>
                    <Text className="text-lg font-bold text-textPrimary">
                      {(avgConf * 100).toFixed(1)}%
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                    <Text className="text-sm text-textSecondary font-medium">Total Weight</Text>
                    <Text className="text-lg font-bold text-textPrimary">{totalWeightKg.toFixed(2)} kg</Text>
                  </View>

                  {totalValue > 0 && (
                    <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                      <Text className="text-sm text-textSecondary font-medium">Total Value</Text>
                      <Text className="text-lg font-bold text-textPrimary">₹{totalValue}</Text>
                    </View>
                  )}

                  <View className="flex-row justify-between items-center py-sm border-b border-borderDark">
                    <Text className="text-sm text-textSecondary font-medium">Disease Status</Text>
                    <View
                      className="rounded-full px-sm py-[4px]" style={{
                          backgroundColor: anyDisease
                            ? COLORS.warning + "20"
                            : COLORS.success + "20",
                        }}
                    >
                      <Text
                        className="text-sm font-bold" style={{
                            color: anyDisease ? COLORS.warning : COLORS.success,
                          }}
                      >
                        {anyDisease ? "Disease Detected" : "All Healthy"}
                      </Text>
                    </View>
                  </View>

                  {Object.keys(speciesDist).length > 0 && (
                    <View className="mt-md pt-md border-t border-borderDark">
                      <Text className="text-sm font-bold text-textPrimary mb-sm">
                        Species Breakdown
                      </Text>
                      {Object.entries(speciesDist)
                        .sort(([, a], [, b]) => b - a)
                        .map(([species, count]) => (
                          <View key={species} className="flex-row justify-between items-center mb-sm">
                            <Text className="text-sm text-textSecondary flex-1">
                              {translateFishName(species, locale)}
                            </Text>
                            <View className="flex-row items-center gap-sm flex-1">
                              <Text className="text-sm font-bold text-textPrimary min-w-[30px] text-right">
                                {count}
                              </Text>
                              <View className="flex-1 h-[8px] bg-borderDark rounded-full overflow-hidden">
                                <View
                                  className="h-full bg-primaryLight rounded-full" style={{ width: `${(count / totalFish) * 100}%` }}
                                />
                              </View>
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                </Card>

                {/* Action Buttons */}
                <View className="flex-row gap-md mt-md mb-md">
                  <Button
                    label="View Detailed Report"
                    onPress={() => router.push("/analysis/detail")}
                    variant="primary"
                    icon={
                      <Ionicons name="document-text" size={16} color="#fff" />
                    }
                    iconPosition="left"
                    className="flex-1"
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
                    className="flex-1"
                  />
                </View>
                <Button
                  label="Ask AI About This Catch"
                  onPress={() => {
                    const speciesList = Object.keys(speciesDist).join(", ");
                    const prompt = `I just analyzed ${totalFish} fish using offline detection. Species: ${speciesList}. What are the current market prices and any recommendations?`;
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
              </View>
            );
          })()}
      </ScrollView>

      {/* Weight Estimation Modal */}
      <WeightEstimateModal
        visible={weightModalVisible}
        onClose={handleWeightCancel}
        onConfirm={handleWeightComplete}
        species={weightSpecies}
        fishIndex={weightFishIndex}
      />
    </SafeAreaView>
  );
}
