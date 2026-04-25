/**
 * Classification Inference using TFLite
 *
 * Uses react-native-fast-tflite for GPU-accelerated inference.
 * Models: Fish.tflite (Species), Fish_disease.tflite (Disease)
 * Input: [1, 224, 224, 3] Float32 (ImageNet normalized)
 */

import {
  loadTensorflowModel,
  type TensorflowModel,
} from "react-native-fast-tflite";
import * as ImageManipulator from "expo-image-manipulator";
import * as jpeg from "jpeg-js";
import { getModelDevicePath } from "./detection";

// ── Constants ──────────────────────────────────────────────────────────────────

// TFLite classification models
const MODEL_INPUT_SIZE = 224;

// ImageNet normalization constants
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

// ── Label Maps ─────────────────────────────────────────────────────────────────

export const SPECIES_LABELS: Record<number, string> = {
  0: "Bangus",
  1: "Big Head Carp",
  2: "Black Spotted Barb",
  3: "Catfish",
  4: "Climbing Perch",
  5: "Fourfinger Threadfin",
  6: "Freshwater Eel",
  7: "Glass Perchlet",
  8: "Goby",
  9: "Gold Fish",
  10: "Gourami",
  11: "Grass Carp",
  12: "Green Spotted Puffer",
  13: "Indian Carp",
  14: "Indo-Pacific Tarpon",
  15: "Jaguar Guapote",
  16: "Janitor Fish",
  17: "Knifefish",
  18: "Long-Snouted Pipefish",
  19: "Mosquito Fish",
  20: "Mudfish",
  21: "Mullet",
  22: "Pangasius",
  23: "Perch",
  24: "Scat Fish",
  25: "Silver Barb",
  26: "Silver Carp",
  27: "Silver Perch",
  28: "Snakehead",
  29: "Tenpounder",
  30: "Tilapia",
};

export const DISEASE_LABELS: Record<number, string> = {
  0: "Bacterial Red disease",
  1: "Bacterial diseases - Aeromoniasis",
  2: "Bacterial gill disease",
  3: "Fungal diseases Saprolegniasis",
  4: "Healthy Fish",
  5: "Parasitic diseases",
  6: "Viral diseases White tail disease",
};

// Species database for additional info
const SPECIES_DATABASE: Record<
  string,
  { scientific: string; avgPrice: number; minSize: number }
> = {
  Bangus: { scientific: "Chanos chanos", avgPrice: 180, minSize: 200 },
  Tenpounder: { scientific: "Elops machnata", avgPrice: 150, minSize: 180 },
  Mullet: { scientific: "Mugil cephalus", avgPrice: 200, minSize: 150 },
  "Glass Perchlet": {
    scientific: "Ambassis ambassis",
    avgPrice: 120,
    minSize: 100,
  },
  "Indo-Pacific Tarpon": {
    scientific: "Megalops cyprinoides",
    avgPrice: 220,
    minSize: 250,
  },
  "Fourfinger Threadfin": {
    scientific: "Eleutheronema tetradactylum",
    avgPrice: 280,
    minSize: 200,
  },
  Knifefish: { scientific: "Chitala chitala", avgPrice: 350, minSize: 300 },
  Tilapia: { scientific: "Oreochromis niloticus", avgPrice: 160, minSize: 180 },
  Catfish: { scientific: "Clarias batrachus", avgPrice: 170, minSize: 150 },
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TFLiteModelDebugInfo {
  speciesModel: {
    isLoaded: boolean;
    loadedUri: string | null;
    searchLocations: string[];
  };
  diseaseModel: {
    isLoaded: boolean;
    loadedUri: string | null;
    searchLocations: string[];
  };
}

export interface ClassificationResult {
  label: string;
  confidence: number;
  classIndex: number;
}

// ── Model Singletons ───────────────────────────────────────────────────────────

let _speciesModel: TensorflowModel | null = null;
let _diseaseModel: TensorflowModel | null = null;
let _speciesModelUri: string | null = null;
let _diseaseModelUri: string | null = null;
let _speciesLoadingPromise: Promise<void> | null = null;
let _diseaseLoadingPromise: Promise<void> | null = null;

const MAX_RUN_RETRIES = 1;

/**
 * Detect the known native-handle-GC error from react-native-fast-tflite.
 */
function isNativeHandleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Value is undefined") || msg.includes("expected an Object")
  );
}

// ── Model Loading ──────────────────────────────────────────────────────────────

export async function loadSpeciesModel(): Promise<void> {
  if (_speciesModel) return;
  if (_speciesLoadingPromise) return _speciesLoadingPromise;
  _speciesLoadingPromise = (async () => {
    try {
      const modelUri = await getModelDevicePath("Fish.tflite");
      console.log(`[TFLite] Loading bundled species model from ${modelUri}`);
      _speciesModel = await loadTensorflowModel({ url: modelUri });
      _speciesModelUri = modelUri;
      console.log(`[TFLite] Species model loaded successfully`);
    } catch (err) {
      console.error("[TFLite] Failed to load species model:", err);
      throw err;
    } finally {
      _speciesLoadingPromise = null;
    }
  })();
  return _speciesLoadingPromise;
}

export async function loadDiseaseModel(): Promise<void> {
  if (_diseaseModel) return;
  if (_diseaseLoadingPromise) return _diseaseLoadingPromise;
  _diseaseLoadingPromise = (async () => {
    try {
      const modelUri = await getModelDevicePath("Fish_disease.tflite");
      console.log(`[TFLite] Loading bundled disease model from ${modelUri}`);
      _diseaseModel = await loadTensorflowModel({ url: modelUri });
      _diseaseModelUri = modelUri;
      console.log(`[TFLite] Disease model loaded successfully`);
    } catch (err) {
      console.error("[TFLite] Failed to load disease model:", err);
      throw err;
    } finally {
      _diseaseLoadingPromise = null;
    }
  })();
  return _diseaseLoadingPromise;
}

export async function loadAllTFLiteModels(): Promise<void> {
  await Promise.all([loadSpeciesModel(), loadDiseaseModel()]);
}

export function areTFLiteModelsLoaded(): boolean {
  return _speciesModel !== null && _diseaseModel !== null;
}

export function getTFLiteModelDebugInfo(): TFLiteModelDebugInfo {
  return {
    speciesModel: {
      isLoaded: _speciesModel !== null,
      loadedUri: _speciesModelUri,
      searchLocations: ["bundled:Fish.tflite"],
    },
    diseaseModel: {
      isLoaded: _diseaseModel !== null,
      loadedUri: _diseaseModelUri,
      searchLocations: ["bundled:Fish_disease.tflite"],
    },
  };
}

// ── Image Preprocessing ────────────────────────────────────────────────────────

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Preprocess image for TFLite inference
 * - Resize to 224x224
 * - Normalize with ImageNet mean/std
 * - Result is [1, 224, 224, 3] Float32Array (NHWC)
 */
async function preprocessImage(imageUri: string): Promise<Float32Array> {
  // 1. Resize to 224x224
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 1.0 },
  );

  if (!resized.base64) {
    throw new Error("Failed to get base64 from image manipulator");
  }

  // 2. Decode JPEG to RGB pixels
  const jpegBytes = base64ToUint8Array(resized.base64);
  const { data: pixels } = jpeg.decode(jpegBytes, {
    useTArray: true,
    formatAsRGBA: false, // RGB format (3 channels)
  });

  // 3. Normalize (ImageNet)
  // TFLite expects NHWC [1, 224, 224, 3]
  // pixels is already HWC [224*224*3] flat array

  const float32 = new Float32Array(pixels.length);
  const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;

  for (let i = 0; i < numPixels; i++) {
    const r = pixels[i * 3 + 0] / 255.0;
    const g = pixels[i * 3 + 1] / 255.0;
    const b = pixels[i * 3 + 2] / 255.0;

    float32[i * 3 + 0] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    float32[i * 3 + 1] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    float32[i * 3 + 2] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return float32;
}

// ── Inference ──────────────────────────────────────────────────────────────────

async function reloadSpeciesModel(): Promise<void> {
  _speciesModel = null;
  _speciesModelUri = null;
  _speciesLoadingPromise = null;
  await loadSpeciesModel();
}

async function reloadDiseaseModel(): Promise<void> {
  _diseaseModel = null;
  _diseaseModelUri = null;
  _diseaseLoadingPromise = null;
  await loadDiseaseModel();
}

export async function classifySpecies(
  imageUri: string,
): Promise<ClassificationResult> {
  if (!_speciesModel) await loadSpeciesModel();
  if (!_speciesModel) throw new Error("Species model not loaded");

  const input = await preprocessImage(imageUri);

  let output: Awaited<ReturnType<TensorflowModel["run"]>>;
  for (let attempt = 0; ; attempt++) {
    try {
      output = await _speciesModel!.run([input]);
      break;
    } catch (runErr) {
      if (attempt < MAX_RUN_RETRIES && isNativeHandleError(runErr)) {
        console.warn(
          `[TFLite] Species model native handle stale (attempt ${attempt + 1}), reloading…`,
        );
        await reloadSpeciesModel();
        continue;
      }
      throw runErr;
    }
  }
  const logits = output[0]; // First output tensor

  const probabilities = softmax(logits as Float32Array);
  const { index, confidence } = getArgMax(probabilities);

  return {
    label: SPECIES_LABELS[index] || "Unknown",
    confidence,
    classIndex: index,
  };
}

export async function classifyDisease(
  imageUri: string,
): Promise<ClassificationResult> {
  if (!_diseaseModel) await loadDiseaseModel();
  if (!_diseaseModel) throw new Error("Disease model not loaded");

  const input = await preprocessImage(imageUri);

  let output: Awaited<ReturnType<TensorflowModel["run"]>>;
  for (let attempt = 0; ; attempt++) {
    try {
      output = await _diseaseModel!.run([input]);
      break;
    } catch (runErr) {
      if (attempt < MAX_RUN_RETRIES && isNativeHandleError(runErr)) {
        console.warn(
          `[TFLite] Disease model native handle stale (attempt ${attempt + 1}), reloading…`,
        );
        await reloadDiseaseModel();
        continue;
      }
      throw runErr;
    }
  }
  const logits = output[0];

  const probabilities = softmax(logits as Float32Array);
  const { index, confidence } = getArgMax(probabilities);

  return {
    label: DISEASE_LABELS[index] || "Unknown",
    confidence,
    classIndex: index,
  };
}

// ── Math Helpers ───────────────────────────────────────────────────────────────

function softmax(logits: Float32Array | number[]): number[] {
  const arr = Array.from(logits);
  const maxLogit = Math.max(...arr);
  const expScores = arr.map((x) => Math.exp(x - maxLogit));
  const sumExp = expScores.reduce((a, b) => a + b, 0);
  return expScores.map((x) => x / sumExp);
}

function getArgMax(probabilities: number[]): {
  index: number;
  confidence: number;
} {
  let maxIndex = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > probabilities[maxIndex]) {
      maxIndex = i;
    }
  }
  return { index: maxIndex, confidence: probabilities[maxIndex] };
}

// ── Helper Functions ───────────────────────────────────────────────────────────

export function getSpeciesInfo(speciesName: string) {
  return (
    SPECIES_DATABASE[speciesName] || {
      scientific: "Unknown species",
      avgPrice: 150,
      minSize: 150,
    }
  );
}

export async function reloadTFLiteModels(): Promise<void> {
  _speciesModel = null;
  _diseaseModel = null;
  _speciesModelUri = null;
  _diseaseModelUri = null;
  _speciesLoadingPromise = null;
  _diseaseLoadingPromise = null;
  await loadAllTFLiteModels();
}
