/**
 * Simple module-level store for passing detailed analysis data
 * to the detailed report page without needing URL params.
 */
import type { GroupAnalysis } from "./types";
import type { OfflineDetectionResult } from "./offline-inference";

export interface OnlineAnalysisData {
  mode: "online";
  groupAnalysis: GroupAnalysis;
  groupId: string;
  imageUris: string[];
  location?: { lat: number; lng: number } | null;
}

export interface OfflineAnalysisData {
  mode: "offline";
  offlineResults: OfflineDetectionResult[];
  processingTime: number;
  imageUri: string;
  location?: { lat: number; lng: number } | null;
  /** ID of the LocalHistoryRecord saved to AsyncStorage - used to patch weight after user entry */
  localRecordId?: string;
}

export type AnalysisData = OnlineAnalysisData | OfflineAnalysisData;

let _current: AnalysisData | null = null;

export function setAnalysisData(data: AnalysisData): void {
  _current = data;
}

export function getAnalysisData(): AnalysisData | null {
  return _current;
}

/**
 * Update the weight for a single fish in the current offline analysis.
 * Called from the detail screen when the user confirms a manual measurement.
 */
export function updateOfflineWeight(fishIndex: number, weightG: number): void {
  if (!_current || _current.mode !== "offline") return;
  const det = _current.offlineResults[fishIndex];
  if (!det) return;
  det.weightG = weightG;
  det.weightUserEntered = true;
  det.estimatedValue = 0; // prices remain unavailable in offline mode
}
