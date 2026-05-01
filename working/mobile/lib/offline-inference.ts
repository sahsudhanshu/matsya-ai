/**
 * Offline ML inference using on-device models:
 * 1. TFLite YOLO for fish detection
 * 2. TFLite ResNet18 for species classification
 * 3. TFLite ResNet18 for disease detection
 * 4. GradCAM for visual explanations
 */
import { runDetection, type BoundingBox } from "./detection";
import type { FishAnalysisResult } from "./types";
import {
  classifySpecies,
  classifyDisease,
  loadAllTFLiteModels,
  getSpeciesInfo,
  areTFLiteModelsLoaded,
  type ClassificationResult,
} from "./tflite-inference";
import { generateGradCAM } from "./gradcam";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";


export interface OfflineDetectionResult {
  bbox: number[];
  species: string;
  speciesConfidence: number;
  disease: string;
  diseaseConfidence: number;
  /** Estimated from bounding box - not reliable for display */
  weightG: number;
  /** True only when the user manually entered a measurement in the detail screen */
  weightUserEntered: boolean;
  lengthMm: number;
  qualityGrade: string;
  pricePerKg: number;
  /** Always 0 for offline results - pricing is unavailable without connectivity */
  estimatedValue: number;
  isLegalSize: boolean;
  minLegalSize: number;
  cropUri?: string;
  gradcamUri?: string;
  error?: string;
}

/**
 * Crop a fish from the original image based on bounding box
 */
async function cropFishImage(
  imageUri: string,
  box: BoundingBox,
  originalWidth: number,
  originalHeight: number,
): Promise<string> {
  const x = Math.round(box.x1 * originalWidth);
  const y = Math.round(box.y1 * originalHeight);
  const width = Math.round((box.x2 - box.x1) * originalWidth);
  const height = Math.round((box.y2 - box.y1) * originalHeight);

  const cropped = await ImageManipulator.manipulateAsync(
    imageUri,
    [
      {
        crop: {
          originX: Math.max(0, x),
          originY: Math.max(0, y),
          width: Math.max(1, width),
          height: Math.max(1, height),
        },
      },
    ],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 },
  );

  return cropped.uri;
}

/**
 * Get original image dimensions
 */
async function getImageDimensions(
  imageUri: string,
): Promise<{ width: number; height: number }> {
  const info = await FileSystem.getInfoAsync(imageUri);
  if (!info.exists) {
    throw new Error("Image file does not exist");
  }

  // Use ImageManipulator to get actual dimensions
  const result = await ImageManipulator.manipulateAsync(imageUri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  });

  // Return actual dimensions from the manipulator result, with fallback
  return {
    width: result.width || 800,
    height: result.height || 600,
  };
}

export interface OfflineInferenceProgress {
  /** 0–100 */
  percent: number;
  /** Human-readable step label */
  step: string;
}

/**
 * Run offline inference: TFLite detection + TFLite classification + GradCAM
 */
export async function runOfflineInference(
  imageUri: string,
  onProgress?: (p: OfflineInferenceProgress) => void,
): Promise<{
  detections: OfflineDetectionResult[];
  processingTime: number;
  errors?: string[];
}> {
  const t0 = Date.now();
  const errors: string[] = [];

  try {
    // Step 1: Ensure TFLite models are loaded
    if (!areTFLiteModelsLoaded()) {
      console.log("[Offline Inference] Loading TFLite models...");
      onProgress?.({ percent: 2, step: "Loading on-device models…" });
      await loadAllTFLiteModels();
    }

    onProgress?.({ percent: 5, step: "Detecting fish…" });

    // Step 2: Run on-device YOLO detection
    let boxes: BoundingBox[] = [];
    try {
      console.log("[Offline Inference] Running YOLO detection...");
      boxes = await runDetection(imageUri);
      console.log(`[Offline Inference] Detected ${boxes.length} fish`);
    } catch (e) {
      console.error("[Offline Inference] runDetection failed:", e);
      throw e;
    }

    onProgress?.({
      percent: 30,
      step: `${boxes.length} fish detected - preparing…`,
    });

    if (boxes.length === 0) {
      onProgress?.({ percent: 100, step: "Done - no fish found" });
      return { detections: [], processingTime: Date.now() - t0, errors };
    }

    // Step 3: Get image dimensions for proper cropping
    let imgWidth: number, imgHeight: number;
    try {
      const dims = await getImageDimensions(imageUri);
      imgWidth = dims.width;
      imgHeight = dims.height;
    } catch (e) {
      console.error("[Offline Inference] getImageDimensions failed:", e);
      throw e;
    }

    // Step 4: Process each detection
    // Progress range: 30 → 95 spread across all fish × 4 sub-steps each
    const totalFish = boxes.length;
    const progressPerFish = totalFish > 0 ? 65 / totalFish : 65;

    const detections: OfflineDetectionResult[] = [];

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      let detection: OfflineDetectionResult;
      const fishBase = 30 + i * progressPerFish;

      try {
        onProgress?.({
          percent: Math.round(fishBase),
          step: `Fish ${i + 1}/${totalFish}: cropping…`,
        });

        // Crop the fish from original image
        const cropUri = await cropFishImage(imageUri, box, imgWidth, imgHeight);
        console.log(
          `[Offline Inference] Processing fish ${i + 1}/${boxes.length}`,
        );

        onProgress?.({
          percent: Math.round(fishBase + progressPerFish * 0.25),
          step: `Fish ${i + 1}/${totalFish}: classifying species…`,
        });

        // Run species classification
        let speciesResult: ClassificationResult;
        try {
          speciesResult = await classifySpecies(cropUri);
          console.log(
            `[Offline Inference] Species: ${speciesResult.label} (${(speciesResult.confidence * 100).toFixed(1)}%)`,
          );
        } catch (err) {
          const errorMsg = `Species classification failed: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[Offline Inference] ${errorMsg}`);
          errors.push(errorMsg);
          throw err;
        }

        onProgress?.({
          percent: Math.round(fishBase + progressPerFish * 0.5),
          step: `Fish ${i + 1}/${totalFish}: checking for disease…`,
        });

        // Run disease classification
        let diseaseResult: ClassificationResult;
        try {
          diseaseResult = await classifyDisease(cropUri);
          console.log(
            `[Offline Inference] Disease: ${diseaseResult.label} (${(diseaseResult.confidence * 100).toFixed(1)}%)`,
          );
        } catch (err) {
          const errorMsg = `Disease classification failed: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[Offline Inference] ${errorMsg}`);
          errors.push(errorMsg);
          throw err;
        }

        onProgress?.({
          percent: Math.round(fishBase + progressPerFish * 0.75),
          step: `Fish ${i + 1}/${totalFish}: generating GradCAM…`,
        });

        // Generate GradCAM visualization
        let gradcamUri: string | undefined;
        try {
          const gradcamResult = await generateGradCAM(
            cropUri,
            speciesResult.classIndex,
          );
          gradcamUri = gradcamResult.overlayUri;
          console.log(`[Offline Inference] GradCAM generated`);
        } catch (err) {
          const errorMsg = `GradCAM generation failed: ${err instanceof Error ? err.message : String(err)}`;
          console.warn(`[Offline Inference] ${errorMsg}`);
          errors.push(errorMsg);
          // GradCAM failure is non-critical, continue without it
        }

        // Get species info
        const speciesInfo = getSpeciesInfo(speciesResult.label);

        // Calculate measurements
        const weightG = 0;
        const lengthMm = 0;
        const qualityGrade = diseaseResult.label === "Healthy Fish" ? "Standard" : "Low";
        const estimatedValue = 0;

        detection = {
          bbox: [
            Math.round(box.x1 * imgWidth),
            Math.round(box.y1 * imgHeight),
            Math.round(box.x2 * imgWidth),
            Math.round(box.y2 * imgHeight),
          ],
          species: speciesResult.label,
          speciesConfidence: speciesResult.confidence,
          disease: diseaseResult.label,
          diseaseConfidence: diseaseResult.confidence,
          weightG,
          weightUserEntered: false,
          lengthMm,
          qualityGrade,
          pricePerKg: speciesInfo.avgPrice,
          estimatedValue: 0,
          isLegalSize: lengthMm >= speciesInfo.minSize,
          minLegalSize: speciesInfo.minSize,
          cropUri,
          gradcamUri,
        };

        // ── Per-fish summary ──────────────────────────────────────
        console.log("\n╔════════════════════════════════════════════════════╗");
        console.log(
          `║  🐟 FISH ${i + 1}/${boxes.length} ANALYSIS                           ║`,
        );
        console.log("╚════════════════════════════════════════════════════╝");
        console.log(`  • Species     : ${speciesResult.label}`);
        console.log(
          `    └ Confidence: ${(speciesResult.confidence * 100).toFixed(1)}%`,
        );
        console.log(`    └ Scientific: ${speciesInfo.scientific}`);
        console.log(`  • Disease     : ${diseaseResult.label}`);
        console.log(
          `    └ Confidence: ${(diseaseResult.confidence * 100).toFixed(1)}%`,
        );
        console.log(`  • Quality     : ${qualityGrade}`);
        console.log("  ────────────────────────────────────────────────────");
        console.log(`  • Measurements:`);
        console.log(
          `    └ Weight    : ${weightG}g (${(weightG / 1000).toFixed(2)}kg)`,
        );
        console.log(`    └ Length    : ${lengthMm}mm`);
        console.log(
          `    └ Legal     : ${lengthMm >= speciesInfo.minSize ? "✅ Yes" : "❌ No"} (min ${speciesInfo.minSize}mm)`,
        );
        console.log(`  • Economics   :`);
        console.log(`    └ Price/kg  : ₹${speciesInfo.avgPrice}`);
        console.log(`    └ Value     : ₹${estimatedValue}`);
        console.log("  ────────────────────────────────────────────────────");
        console.log(`  • Tech Info   :`);
        console.log(`    └ Bbox      : [${detection.bbox.join(", ")}]`);
        console.log(
          `    └ GradCAM   : ${gradcamUri ? "✅ Generated" : "⚠️ Skipped"}`,
        );
        console.log("\n");
      } catch (err) {
        // If classification fails for this detection, create a partial result
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[Offline Inference] Failed to process detection ${i + 1}:`,
          errorMsg,
        );

        detection = {
          bbox: [
            Math.round(box.x1 * imgWidth),
            Math.round(box.y1 * imgHeight),
            Math.round(box.x2 * imgWidth),
            Math.round(box.y2 * imgHeight),
          ],
          species: "Unknown",
          speciesConfidence: 0,
          disease: "Unknown",
          diseaseConfidence: 0,
          weightG: 0,
          weightUserEntered: false,
          lengthMm: 0,
          qualityGrade: "Unknown",
          pricePerKg: 0,
          estimatedValue: 0,
          isLegalSize: false,
          minLegalSize: 0,
          error: errorMsg,
        };
      }

      detections.push(detection);
    }

    const processingTime = Date.now() - t0;

    onProgress?.({
      percent: 100,
      step: `Done - ${detections.length} fish analysed`,
    });

    // ── Final summary ─────────────────────────────────────────
    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║  🏁 OFFLINE INFERENCE COMPLETE                     ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log(`  • Total Fish    : ${detections.length}`);
    console.log(
      `  • Pipeline Time : ${processingTime}ms (${(processingTime / 1000).toFixed(1)}s)`,
    );

    if (detections.length > 0) {
      const successful = detections.filter((d) => !d.error);
      const failed = detections.filter((d) => d.error);

      console.log(
        `  • Status        : ${successful.length} Success, ${failed.length} Failed`,
      );
      console.log("  ────────────────────────────────────────────────────");

      if (successful.length > 0) {
        console.log("  Results Summary:");
        successful.forEach((d, idx) => {
          console.log(
            `  Fish #${idx + 1}: ${d.species.padEnd(15)} | ${d.disease.padEnd(15)} | ${d.qualityGrade.padEnd(8)} | ₹${d.estimatedValue}`,
          );
        });
      }
    }

    if (errors.length > 0) {
      console.log("  ────────────────────────────────────────────────────");
      console.log(`  ⚠️ ERRORS (${errors.length}):`);
      errors.forEach((e) => console.log(`    • ${e}`));
    }
    console.log("\n");

    return {
      detections,
      processingTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err) {
    const errorMsg = `Offline inference failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[Offline Inference] ${errorMsg}`);
    errors.push(errorMsg);

    return {
      detections: [],
      processingTime: Date.now() - t0,
      errors,
    };
  }
}

/**
 * Convert offline detection to FishAnalysisResult format (for the first/best detection)
 */
export function offlineResultToAnalysisResult(
  detection: OfflineDetectionResult,
): FishAnalysisResult {
  const speciesInfo = getSpeciesInfo(detection.species);
  const obj = {
    species: detection.species,
    scientificName: speciesInfo.scientific,
    confidence: detection.speciesConfidence,
    measurements: {
      length_mm: detection.lengthMm,
      weight_g: detection.weightG,
      width_mm: Math.round(detection.lengthMm * 0.3), // Approximate width
    },
    qualityGrade: detection.qualityGrade as "Premium" | "Standard" | "Low",
    marketEstimate: {
      price_per_kg: detection.pricePerKg,
      estimated_value: detection.estimatedValue,
    },
    compliance: {
      is_legal_size: detection.isLegalSize,
      min_legal_size_mm: detection.minLegalSize,
    },
    isSustainable:
      detection.disease === "Healthy Fish" && detection.isLegalSize,
    weightEstimate: detection.weightG,
    weightConfidence: detection.speciesConfidence,
    marketPriceEstimate: detection.estimatedValue,
    timestamp: new Date().toISOString(),
  };
  console.log(obj);
  return obj;
}

// Re-export TFLite utilities for convenience
export {
  loadAllTFLiteModels,
  areTFLiteModelsLoaded,
  getTFLiteModelDebugInfo,
} from "./tflite-inference";
export { cleanupGradCAMCache } from "./gradcam";
