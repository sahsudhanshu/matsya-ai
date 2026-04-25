/**
 * On-device fish detection using TFLite (YOLOv8/v11)
 *
 * Model specs:
 *   Input  : [1, 256, 256, 3]  float32  (RGB, 0-1 normalised)
 *   Output : [1, 8, 1344]      float32
 *            8 = 4 bbox coords (cx, cy, w, h) + 4 class scores
 *            1344 = detection anchors for 256×256 input
 *
 * Post-processing: confidence threshold → NMS → normalised bounding boxes
 */

import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import * as ImageManipulator from "expo-image-manipulator";
import * as jpeg from "jpeg-js";
import * as FileSystem from "expo-file-system/legacy";

// ── Constants ──────────────────────────────────────────────────────────────────

const MODEL_INPUT_SIZE = 256;
const NUM_CLASSES = 4;
const NUM_DETECTIONS = 1344;
const CONFIDENCE_THRESHOLD = 0.30;
const IOU_THRESHOLD = 0.45;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BoundingBox {
  /** Normalised coordinates in [0, 1] relative to the original image */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

export interface ModelDebugInfo {
  modelName: string;
  isLoaded: boolean;
  loadedUri: string | null;
  searchLocations: string[];
}

// ── Model singleton ────────────────────────────────────────────────────────────

let _model: TensorflowModel | null = null;
let _loadedModelUri: string | null = null;
let _loadingPromise: Promise<void> | null = null;

const MODEL_FILENAME = "detection_float32.tflite";
const MAX_RUN_RETRIES = 1;

/**
 * Resolve the on-device path for a model file.
 * Models are deployed via ADB into the app's internal files/models/ directory.
 * Run `npm run deploy-models` (or `scripts/deploy-models.sh`) to push them.
 */
export function getModelDevicePath(filename: string): string {
  const base =
    FileSystem.documentDirectory ??
    "file:///data/user/0/com.aiforbharat.oceanai/files/";
  return `${base}models/${filename}`;
}

export async function loadModel(): Promise<void> {
  if (_model) return;
  // Prevent concurrent loads – reuse in-flight promise
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    try {
      const modelUri = getModelDevicePath(MODEL_FILENAME);
      const info = await FileSystem.getInfoAsync(modelUri);
      if (!info.exists) {
        throw new Error(
          `Detection model not found at ${modelUri}.\n` +
            `Deploy models to device first:\n  npm run deploy-models`,
        );
      }
      console.log(`[Detection] Loading model from ${modelUri}`);
      _model = await loadTensorflowModel({ url: modelUri });
      _loadedModelUri = modelUri;
      console.log(`[Detection] TFLite model loaded successfully`);
    } catch (err) {
      console.error("[Detection] Failed to load model:", err);
      throw err;
    } finally {
      _loadingPromise = null;
    }
  })();
  return _loadingPromise;
}

export async function reloadModel(): Promise<void> {
  _model = null;
  _loadedModelUri = null;
  _loadingPromise = null;
  await loadModel();
}

/**
 * Detect whether an error is the known native-handle-GC issue
 * from react-native-fast-tflite ("Value is undefined, expected an Object").
 */
function isNativeHandleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Value is undefined") || msg.includes("expected an Object")
  );
}

export function isModelLoaded(): boolean {
  return _model !== null;
}

export function getModelDebugInfo(): ModelDebugInfo {
  return {
    modelName: MODEL_FILENAME,
    isLoaded: _model !== null,
    loadedUri: _loadedModelUri,
    searchLocations: [getModelDevicePath(MODEL_FILENAME)],
  };
}

// ── Image → Float32Array ───────────────────────────────────────────────────────

/**
 * Decode a base64 string into a Uint8Array.
 * Uses the global atob() available in Hermes (RN ≥ 0.72).
 */
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
 * Resize the picked image to 256 × 256, decode it to raw RGB pixels,
 * and return a Float32Array normalised to [0, 1].
 */
async function imageToTensor(imageUri: string): Promise<Float32Array> {
  // 1. Resize to model input size & export as base64 JPEG
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 1.0 },
  );

  if (!resized.base64) {
    throw new Error("expo-image-manipulator did not return base64");
  }

  // 2. Decode JPEG → raw RGB pixels
  const jpegBytes = base64ToUint8Array(resized.base64);
  const { data: pixels } = jpeg.decode(jpegBytes, {
    useTArray: true,
    formatAsRGBA: false, // returns RGB (3 bytes/pixel)
  });

  // 3. Normalise to [0, 1] - input shape [1, 256, 256, 3]
  const float32 = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
  for (let i = 0; i < pixels.length; i++) {
    float32[i] = pixels[i] / 255.0;
  }

  return float32;
}

// ── YOLOv8 post-processing ────────────────────────────────────────────────────

function iou(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

function nms(boxes: BoundingBox[], threshold: number): BoundingBox[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const keep: BoundingBox[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    keep.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (!suppressed.has(j) && iou(sorted[i], sorted[j]) >= threshold) {
        suppressed.add(j);
      }
    }
  }
  return keep;
}

/**
 * Parse the raw [1, 8, 1344] output tensor.
 *
 * Memory layout (channel-first for features, row-major):
 *   row 0 : cx  for all 1344 anchors
 *   row 1 : cy
 *   row 2 : w
 *   row 3 : h
 *   row 4–7 : class scores (4 classes)
 */
function parseModelOutput(output: Float32Array): BoundingBox[] {
  const raw: BoundingBox[] = [];

  let maxCoordAbs = 0;
  for (let i = 0; i < NUM_DETECTIONS; i++) {
    const cx = Math.abs(output[0 * NUM_DETECTIONS + i]);
    const cy = Math.abs(output[1 * NUM_DETECTIONS + i]);
    const w = Math.abs(output[2 * NUM_DETECTIONS + i]);
    const h = Math.abs(output[3 * NUM_DETECTIONS + i]);
    maxCoordAbs = Math.max(maxCoordAbs, cx, cy, w, h);
  }

  const coordsAreNormalized = maxCoordAbs <= 2;
  const coordScale = coordsAreNormalized ? 1 : MODEL_INPUT_SIZE;

  for (let i = 0; i < NUM_DETECTIONS; i++) {
    const cx = output[0 * NUM_DETECTIONS + i];
    const cy = output[1 * NUM_DETECTIONS + i];
    const w = output[2 * NUM_DETECTIONS + i];
    const h = output[3 * NUM_DETECTIONS + i];

    // Max class score as confidence
    let maxConf = 0;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const score = output[(4 + c) * NUM_DETECTIONS + i];
      if (score > maxConf) maxConf = score;
    }
    if (maxConf < CONFIDENCE_THRESHOLD) continue;

    // Convert center-wh → xyxy, normalised to [0,1]
    const x1 = (cx - w / 2) / coordScale;
    const y1 = (cy - h / 2) / coordScale;
    const x2 = (cx + w / 2) / coordScale;
    const y2 = (cy + h / 2) / coordScale;

    raw.push({
      x1: Math.max(0, Math.min(1, x1)),
      y1: Math.max(0, Math.min(1, y1)),
      x2: Math.max(0, Math.min(1, x2)),
      y2: Math.max(0, Math.min(1, y2)),
      confidence: maxConf,
    });
  }

  console.log(
    `[Detection] Output decode: coordsAreNormalized=${coordsAreNormalized}, maxCoordAbs=${maxCoordAbs.toFixed(3)}, rawCandidates=${raw.length}`,
  );

  return nms(raw, IOU_THRESHOLD);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run YOLO detection on an image. Returns normalised bounding boxes.
 * Loads the model on first call (cached afterwards).
 */
export async function runDetection(imageUri: string): Promise<BoundingBox[]> {
  if (!_model) await loadModel();
  if (!_model) throw new Error("Model failed to load");

  const tStart = Date.now();
  const inputTensor = await imageToTensor(imageUri);
  const tPre = Date.now();

  let outputs: Awaited<ReturnType<TensorflowModel["run"]>>;
  for (let attempt = 0; ; attempt++) {
    try {
      outputs =  _model!.runSync([inputTensor]);
      break;
    } catch (runErr) {
      if (attempt < MAX_RUN_RETRIES && isNativeHandleError(runErr)) {
        console.warn(
          `[Detection] Native handle stale (attempt ${attempt + 1}), reloading model…`,
        );
        await reloadModel();
        continue;
      }
      throw runErr;
    }
  }
  const tInfer = Date.now();

  const outputTensor = outputs[0] as Float32Array;
  const boxes = parseModelOutput(outputTensor);

  // Formatted Logging
  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║  🔍 YOLO DETECTION SUMMARY                         ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log(`  • Preprocessing : ${tPre - tStart} ms`);
  console.log(`  • Inference     : ${tInfer - tPre} ms`);
  console.log(`  • Post-processing: ${Date.now() - tInfer} ms`);
  console.log(`  • Tensor Shape  : [1, 8, 1344]`);
  console.log(`  • Detections    : ${boxes.length} found`);

  if (boxes.length > 0) {
    console.log("  ────────────────────────────────────────────────────");
    console.log("  Top Detections:");
    boxes.slice(0, 5).forEach((b, i) => {
      console.log(
        `  #${i + 1}: Conf ${(b.confidence * 100).toFixed(1)}% | Box [${b.x1.toFixed(2)}, ${b.y1.toFixed(2)}, ${b.x2.toFixed(2)}, ${b.y2.toFixed(2)}]`,
      );
    });
    if (boxes.length > 5) console.log(`  ... and ${boxes.length - 5} more`);
  }
  console.log("\n");

  return boxes;
}
