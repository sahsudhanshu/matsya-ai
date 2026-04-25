/**
 * URL utilities for handling image URLs from the backend API
 * Ensures gradcam and crop images load correctly by prefixing with API base URL if needed
 */

import { API_BASE_URL } from './constants';

/**
 * Ensure a URL is absolute by prefixing with API base URL if it's relative
 * Handles S3 paths, crop paths, and gradcam paths
 * 
 * Note: The backend now converts ML API URLs to absolute URLs, so this function
 * should mostly receive absolute URLs. We keep this as a safety fallback.
 */
export function ensureAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Already absolute (starts with http/https) - return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.log(`[URL] Already absolute: ${url}`);
    return url;
  }
  
  // Relative path - this should rarely happen now that backend converts URLs
  // But we keep this as a fallback for backward compatibility
  if (API_BASE_URL) {
    // Remove leading slash if present to avoid double slashes
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const absoluteUrl = `${API_BASE_URL}${cleanUrl}`;
    console.warn(`[URL] Converting relative to absolute (unexpected): ${url} -> ${absoluteUrl}`);
    return absoluteUrl;
  }
  
  // No API base URL configured, return as-is (might fail but at least we tried)
  console.warn(`[URL] No API_BASE_URL configured, URL may fail to load: ${url}`);
  return url;
}

/**
 * Ensure all image URLs in a group analysis result are absolute
 * This helps fix issues where gradcam and crop images don't load
 */
export function normalizeGroupAnalysisUrls(groupAnalysis: any): any {
  const normalized = JSON.parse(JSON.stringify(groupAnalysis));
  
  if (normalized.images) {
    normalized.images.forEach((image: any, imageIdx: number) => {
      // Normalize YOLO image URL
      if (image.yolo_image_url) {
        console.log(`[URL] Processing image ${imageIdx} YOLO URL: ${image.yolo_image_url}`);
        image.yolo_image_url = ensureAbsoluteUrl(image.yolo_image_url);
      }
      
      // Normalize crop URLs and gradcam URLs
      if (image.crops) {
        Object.entries(image.crops).forEach(([cropKey, crop]: [string, any]) => {
          console.log(`[URL] Processing crop ${cropKey}:`);
          
          if (crop.crop_url) {
            console.log(`  - crop_url: ${crop.crop_url}`);
            crop.crop_url = ensureAbsoluteUrl(crop.crop_url);
          }
          
          if (crop.species?.gradcam_url) {
            console.log(`  - species.gradcam_url: ${crop.species.gradcam_url}`);
            crop.species.gradcam_url = ensureAbsoluteUrl(crop.species.gradcam_url);
          }
          
          if (crop.disease?.gradcam_url) {
            console.log(`  - disease.gradcam_url: ${crop.disease.gradcam_url}`);
            crop.disease.gradcam_url = ensureAbsoluteUrl(crop.disease.gradcam_url);
          }
        });
      }
    });
  }
  
  console.log("[URL] ✅ URL normalization complete");
  return normalized;
}
