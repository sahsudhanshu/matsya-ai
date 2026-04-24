/**
 * GradCAM (Gradient-weighted Class Activation Mapping) Implementation
 *
 * Generates visual explanations for CNN predictions by highlighting
 * important regions in the input image.
 *
 * Note: This is a simplified version for React Native. Full GradCAM requires
 * gradient computation which is not directly available in TFLite Runtime.
 * We'll use a heatmap approximation based on activation patterns.
 */

import { Buffer } from "buffer";
// Polyfill Buffer for jpeg-js
if (typeof global.Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}

import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as jpeg from "jpeg-js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GradCAMResult {
  heatmapUri: string;
  overlayUri: string;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate a simple attention heatmap based on image features
 *
 * This is a simplified approximation since we don't have access to gradients
 * in TFLite Runtime. We create a heatmap based on:
 * - Edge detection
 * - Color variance
 * - Brightness patterns
 *
 * For production, consider using a model that outputs attention maps directly.
 */
async function generateSimpleHeatmap(
  imageUri: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  // Resize image to working size
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width, height } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 1.0 },
  );

  if (!resized.base64) {
    throw new Error("Failed to get base64 from image");
  }

  const jpegBytes = base64ToUint8Array(resized.base64);
  const { data: pixels } = jpeg.decode(jpegBytes, {
    useTArray: true,
    formatAsRGBA: false,
  });

  // Create heatmap based on edge detection and color variance
  const heatmap = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 3;

      // Get current pixel RGB
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      // Calculate edge strength (Sobel-like)
      let edgeStrength = 0;

      // Horizontal gradient
      const leftIdx = (y * width + (x - 1)) * 3;
      const rightIdx = (y * width + (x + 1)) * 3;
      const gx =
        Math.abs(pixels[rightIdx] - pixels[leftIdx]) +
        Math.abs(pixels[rightIdx + 1] - pixels[leftIdx + 1]) +
        Math.abs(pixels[rightIdx + 2] - pixels[leftIdx + 2]);

      // Vertical gradient
      const topIdx = ((y - 1) * width + x) * 3;
      const bottomIdx = ((y + 1) * width + x) * 3;
      const gy =
        Math.abs(pixels[bottomIdx] - pixels[topIdx]) +
        Math.abs(pixels[bottomIdx + 1] - pixels[topIdx + 1]) +
        Math.abs(pixels[bottomIdx + 2] - pixels[topIdx + 2]);

      edgeStrength = Math.sqrt(gx * gx + gy * gy) / 3;

      // Color variance (higher variance = more interesting)
      const mean = (r + g + b) / 3;
      const variance =
        Math.abs(r - mean) + Math.abs(g - mean) + Math.abs(b - mean);

      // Combine features
      heatmap[y * width + x] = (edgeStrength * 0.7 + variance * 0.3) / 255;
    }
  }

  // Apply Gaussian blur to smooth heatmap
  const blurred = gaussianBlur(heatmap, width, height, 5);

  // Normalize to [0, 1]
  // Avoid Math.max/min(...spread) which can blow the call stack on large arrays
  let max = -Infinity;
  let min = Infinity;
  for (let i = 0; i < blurred.length; i++) {
    if (blurred[i] > max) max = blurred[i];
    if (blurred[i] < min) min = blurred[i];
  }
  const range = max - min;

  for (let i = 0; i < blurred.length; i++) {
    blurred[i] = range > 0 ? (blurred[i] - min) / range : 0;
  }

  // Convert to RGB heatmap (jet colormap)
  const heatmapRGB = new Uint8Array(width * height * 3);
  for (let i = 0; i < blurred.length; i++) {
    const value = blurred[i];
    const rgb = jetColormap(value);
    heatmapRGB[i * 3] = rgb[0];
    heatmapRGB[i * 3 + 1] = rgb[1];
    heatmapRGB[i * 3 + 2] = rgb[2];
  }

  return heatmapRGB;
}

/**
 * Simple Gaussian blur implementation
 */
function gaussianBlur(
  data: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const result = new Float32Array(data.length);
  const kernel = createGaussianKernel(radius);
  const kernelSize = kernel.length;
  const halfKernel = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;

      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const px = Math.max(0, Math.min(width - 1, x + kx));
          const py = Math.max(0, Math.min(height - 1, y + ky));
          const weight = kernel[ky + halfKernel] * kernel[kx + halfKernel];
          sum += data[py * width + px] * weight;
          weightSum += weight;
        }
      }

      result[y * width + x] = sum / weightSum;
    }
  }

  return result;
}

/**
 * Create 1D Gaussian kernel
 */
function createGaussianKernel(radius: number): number[] {
  const size = radius * 2 + 1;
  const kernel = new Array(size);
  const sigma = radius / 3;
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Jet colormap: blue -> cyan -> yellow -> red
 */
function jetColormap(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));

  let r, g, b;

  if (v < 0.25) {
    r = 0;
    g = v * 4;
    b = 1;
  } else if (v < 0.5) {
    r = 0;
    g = 1;
    b = 1 - (v - 0.25) * 4;
  } else if (v < 0.75) {
    r = (v - 0.5) * 4;
    g = 1;
    b = 0;
  } else {
    r = 1;
    g = 1 - (v - 0.75) * 4;
    b = 0;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Overlay heatmap on original image
 */
async function overlayHeatmap(
  originalUri: string,
  heatmapRGB: Uint8Array,
  width: number,
  height: number,
  alpha: number = 0.4,
): Promise<string> {
  // Get original image
  const resized = await ImageManipulator.manipulateAsync(
    originalUri,
    [{ resize: { width, height } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 1.0 },
  );

  if (!resized.base64) {
    throw new Error("Failed to get base64 from original image");
  }

  const jpegBytes = base64ToUint8Array(resized.base64);
  const { data: originalPixels } = jpeg.decode(jpegBytes, {
    useTArray: true,
    formatAsRGBA: false,
  });

  // Blend original with heatmap (output as RGBA for jpeg.encode compatibility)
  const blended = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * 3;
    const dstIdx = i * 4;
    blended[dstIdx] = Math.round(
      originalPixels[srcIdx] * (1 - alpha) + heatmapRGB[srcIdx] * alpha,
    );
    blended[dstIdx + 1] = Math.round(
      originalPixels[srcIdx + 1] * (1 - alpha) + heatmapRGB[srcIdx + 1] * alpha,
    );
    blended[dstIdx + 2] = Math.round(
      originalPixels[srcIdx + 2] * (1 - alpha) + heatmapRGB[srcIdx + 2] * alpha,
    );
    blended[dstIdx + 3] = 255; // fully opaque alpha
  }

  // Encode back to JPEG (jpeg-js expects RGBA data)
  const jpegData = jpeg.encode(
    {
      data: blended,
      width,
      height,
    },
    90,
  );

  // Save to file
  const fileName = `gradcam_${Date.now()}.jpg`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  const base64 = uint8ArrayToBase64(jpegData.data);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate GradCAM visualization for a fish image
 *
 * @param imageUri - URI of the cropped fish image
 * @param classIndex - Predicted class index (for reference)
 * @returns URIs for heatmap and overlay images
 */
export async function generateGradCAM(
  imageUri: string,
  classIndex: number,
): Promise<GradCAMResult> {
  try {
    const width = 256;
    const height = 256;

    // Generate heatmap
    const heatmapRGB = await generateSimpleHeatmap(imageUri, width, height);

    // Convert heatmap RGB to RGBA for jpeg.encode
    const heatmapRGBA = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      heatmapRGBA[i * 4] = heatmapRGB[i * 3];
      heatmapRGBA[i * 4 + 1] = heatmapRGB[i * 3 + 1];
      heatmapRGBA[i * 4 + 2] = heatmapRGB[i * 3 + 2];
      heatmapRGBA[i * 4 + 3] = 255;
    }

    // Save heatmap (jpeg-js expects RGBA data)
    const heatmapJpeg = jpeg.encode(
      {
        data: heatmapRGBA,
        width,
        height,
      },
      90,
    );

    const heatmapFileName = `heatmap_${Date.now()}.jpg`;
    const heatmapUri = `${FileSystem.cacheDirectory}${heatmapFileName}`;
    const heatmapBase64 = uint8ArrayToBase64(heatmapJpeg.data);
    await FileSystem.writeAsStringAsync(heatmapUri, heatmapBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create overlay
    const overlayUri = await overlayHeatmap(
      imageUri,
      heatmapRGB,
      width,
      height,
      0.4,
    );

    return {
      heatmapUri,
      overlayUri,
    };
  } catch (err) {
    console.error("[GradCAM] Generation error:", err);
    throw new Error(
      `GradCAM generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Clean up cached GradCAM images
 */
export async function cleanupGradCAMCache(): Promise<void> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;

    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const gradcamFiles = files.filter(
      (f) => f.startsWith("gradcam_") || f.startsWith("heatmap_"),
    );

    for (const file of gradcamFiles) {
      await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
    }

    console.log(`[GradCAM] Cleaned up ${gradcamFiles.length} cached files`);
  } catch (err) {
    console.error("[GradCAM] Cleanup error:", err);
  }
}
