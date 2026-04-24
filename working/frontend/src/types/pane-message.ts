/**
 * PaneMessage protocol types and utilities for bidirectional communication
 * between ContentCanvas components and AgentInterface
 */

import type { PaneMessage, PaneMessageType, PaneMessageSource } from './agent-first';

// ── Message Payload Types ─────────────────────────────────────────────────────

export interface UploadStartedPayload {
  fileCount: number;
  totalSize: number;
}

export interface UploadProgressPayload {
  fileIndex: number;
  progress: number; // 0-100
  fileName: string;
}

export interface UploadCompletePayload {
  groupId: string;
  imageCount: number;
  s3Keys: string[];
}

export interface AnalysisCompletePayload {
  groupId: string;
  fishCount: number;
  topSpecies: string;
  totalWeight: number;
  totalValue: number;
}

export interface MapClickPayload {
  latitude: number;
  longitude: number;
  action: 'click' | 'long_press';
}

export interface MapMarkerClickPayload {
  imageId: string;
  species?: string;
  weight?: number;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface MapBoundsChangePayload {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom: number;
}

export interface MapLayerChangePayload {
  layer: 'temperature' | 'currents' | 'depth' | 'catches';
  enabled: boolean;
}

export interface AnalyticsChartClickPayload {
  chartType: 'earnings' | 'species';
  dataPoint: {
    label: string;
    value: number;
    date?: string;
  };
}

export interface AnalyticsFilterChangePayload {
  dateRange?: { from: string; to: string };
  species?: string;
}

export interface AnalyticsDataLoadedPayload {
  totalCatches: number;
  totalEarnings: number;
  dateRange: { from: string; to: string };
}

// ── Message Type Guards ───────────────────────────────────────────────────────

export function isUploadMessage(msg: PaneMessage): msg is PaneMessage & { source: 'upload' } {
  return msg.source === 'upload';
}

export function isMapMessage(msg: PaneMessage): msg is PaneMessage & { source: 'map' } {
  return msg.source === 'map';
}

export function isAnalyticsMessage(msg: PaneMessage): msg is PaneMessage & { source: 'analytics' } {
  return msg.source === 'analytics';
}

// ── Message Validation Schema ─────────────────────────────────────────────────

export interface PaneMessageSchema {
  type: PaneMessageType;
  source: PaneMessageSource;
  requiredFields: string[];
  optionalFields?: string[];
}

export const MESSAGE_SCHEMAS: Record<string, PaneMessageSchema> = {
  'upload:started': {
    type: 'info',
    source: 'upload',
    requiredFields: ['fileCount', 'totalSize']
  },
  'upload:progress': {
    type: 'info',
    source: 'upload',
    requiredFields: ['fileIndex', 'progress', 'fileName']
  },
  'upload:complete': {
    type: 'data',
    source: 'upload',
    requiredFields: ['groupId', 'imageCount', 's3Keys']
  },
  'analysis:complete': {
    type: 'data',
    source: 'upload',
    requiredFields: ['groupId', 'fishCount', 'topSpecies', 'totalWeight', 'totalValue']
  },
  'map:click': {
    type: 'query',
    source: 'map',
    requiredFields: ['latitude', 'longitude', 'action']
  },
  'map:marker_click': {
    type: 'query',
    source: 'map',
    requiredFields: ['imageId', 'latitude', 'longitude', 'createdAt'],
    optionalFields: ['species', 'weight']
  },
  'map:bounds_change': {
    type: 'info',
    source: 'map',
    requiredFields: ['bounds', 'zoom']
  },
  'map:layer_change': {
    type: 'action',
    source: 'map',
    requiredFields: ['layer', 'enabled']
  },
  'analytics:chart_click': {
    type: 'query',
    source: 'analytics',
    requiredFields: ['chartType', 'dataPoint']
  },
  'analytics:filter_change': {
    type: 'action',
    source: 'analytics',
    requiredFields: [],
    optionalFields: ['dateRange', 'species']
  },
  'analytics:data_loaded': {
    type: 'info',
    source: 'analytics',
    requiredFields: ['totalCatches', 'totalEarnings', 'dateRange']
  },
  'analytics:export_request': {
    type: 'action',
    source: 'analytics',
    requiredFields: []
  }
};
