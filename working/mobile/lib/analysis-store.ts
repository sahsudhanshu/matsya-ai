/**
 * Simple module-level store for passing detailed analysis data
 * to the detailed report page without needing URL params.
 */
import type { GroupAnalysis } from './types';
import type { OfflineDetectionResult } from './offline-inference';

export interface OnlineAnalysisData {
  mode: 'online';
  groupAnalysis: GroupAnalysis;
  groupId: string;
  imageUris: string[];
  location?: { lat: number; lng: number } | null;
}

export interface OfflineAnalysisData {
  mode: 'offline';
  offlineResults: OfflineDetectionResult[];
  processingTime: number;
  imageUri: string;
  location?: { lat: number; lng: number } | null;
}

export type AnalysisData = OnlineAnalysisData | OfflineAnalysisData;

let _current: AnalysisData | null = null;

export function setAnalysisData(data: AnalysisData): void {
  _current = data;
}

export function getAnalysisData(): AnalysisData | null {
  return _current;
}
