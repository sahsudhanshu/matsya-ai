/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PaneMessage utilities for creating, validating, and logging messages
 * 
 * This module provides helper functions for the PaneMessage protocol that enables
 * bidirectional communication between ContentCanvas components and AgentInterface.
 * 
 * Requirements: 30.1, 30.5, 30.6
 */

import type { PaneMessage, PaneMessageType, PaneMessageSource } from '@/types/agent-first';
import type { PaneMessageSchema } from '@/types/pane-message';
import { MESSAGE_SCHEMAS } from '@/types/pane-message';

// ── Message Creation Helpers ──────────────────────────────────────────────────

/**
 * Creates a new PaneMessage with automatic ID and timestamp generation
 * 
 * @param type - Message type (info, action, data, error, query)
 * @param source - Component source (upload, map, analytics)
 * @param payload - Message payload data
 * @param metadata - Optional metadata (userInitiated, requiresResponse)
 * @returns A complete PaneMessage object
 */
export function createPaneMessage(
  type: PaneMessageType,
  source: PaneMessageSource,
  payload: Record<string, any>,
  metadata?: {
    userInitiated?: boolean;
    requiresResponse?: boolean;
  }
): PaneMessage {
  return {
    id: generateMessageId(),
    type,
    source,
    payload,
    timestamp: Date.now(),
    metadata: {
      userInitiated: metadata?.userInitiated ?? false,
      requiresResponse: metadata?.requiresResponse ?? false,
    },
  };
}

/**
 * Generates a unique message ID using timestamp and random string
 * Format: msg_<timestamp>_<random>
 */
function generateMessageId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `msg_${timestamp}_${random}`;
}

// ── Upload Component Message Helpers ──────────────────────────────────────────

export function createUploadStartedMessage(fileCount: number, totalSize: number): PaneMessage {
  return createPaneMessage('info', 'upload', {
    fileCount,
    totalSize,
  });
}

export function createUploadProgressMessage(
  fileIndex: number,
  progress: number,
  fileName: string
): PaneMessage {
  return createPaneMessage('info', 'upload', {
    fileIndex,
    progress,
    fileName,
  });
}

export function createUploadCompleteMessage(
  groupId: string,
  imageCount: number,
  s3Keys: string[]
): PaneMessage {
  return createPaneMessage('data', 'upload', {
    groupId,
    imageCount,
    s3Keys,
  });
}

export function createAnalysisCompleteMessage(
  groupId: string,
  fishCount: number,
  topSpecies: string,
  totalWeight: number,
  totalValue: number
): PaneMessage {
  return createPaneMessage(
    'data',
    'upload',
    {
      groupId,
      fishCount,
      topSpecies,
      totalWeight,
      totalValue,
    },
    { requiresResponse: true }
  );
}

// ── Map Component Message Helpers ─────────────────────────────────────────────

export function createMapClickMessage(
  latitude: number,
  longitude: number,
  action: 'click' | 'long_press' = 'click'
): PaneMessage {
  return createPaneMessage(
    'query',
    'map',
    {
      latitude,
      longitude,
      action,
    },
    { userInitiated: true, requiresResponse: true }
  );
}

export function createMapMarkerClickMessage(
  imageId: string,
  latitude: number,
  longitude: number,
  createdAt: string,
  species?: string,
  weight?: number
): PaneMessage {
  return createPaneMessage(
    'query',
    'map',
    {
      imageId,
      latitude,
      longitude,
      createdAt,
      ...(species && { species }),
      ...(weight && { weight }),
    },
    { userInitiated: true, requiresResponse: true }
  );
}

export function createMapBoundsChangeMessage(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): PaneMessage {
  return createPaneMessage('info', 'map', {
    bounds,
    zoom,
  });
}

export function createMapLayerChangeMessage(
  layer: 'temperature' | 'currents' | 'depth' | 'catches',
  enabled: boolean
): PaneMessage {
  return createPaneMessage('action', 'map', {
    layer,
    enabled,
  });
}

// ── Analytics Component Message Helpers ───────────────────────────────────────

export function createAnalyticsChartClickMessage(
  chartType: 'earnings' | 'species',
  dataPoint: { label: string; value: number; date?: string }
): PaneMessage {
  return createPaneMessage(
    'query',
    'analytics',
    {
      chartType,
      dataPoint,
    },
    { userInitiated: true, requiresResponse: true }
  );
}

export function createAnalyticsFilterChangeMessage(
  filters: {
    dateRange?: { from: string; to: string };
    species?: string;
  }
): PaneMessage {
  return createPaneMessage('action', 'analytics', filters);
}

export function createAnalyticsDataLoadedMessage(
  totalCatches: number,
  totalEarnings: number,
  dateRange: { from: string; to: string }
): PaneMessage {
  return createPaneMessage('info', 'analytics', {
    totalCatches,
    totalEarnings,
    dateRange,
  });
}

export function createAnalyticsExportRequestMessage(): PaneMessage {
  return createPaneMessage('action', 'analytics', {}, { userInitiated: true });
}

// ── Message Validation ────────────────────────────────────────────────────────

/**
 * Validates a PaneMessage against its schema
 * 
 * @param message - The message to validate
 * @param schemas - Message schemas (imported from pane-message.ts)
 * @returns Validation result with success flag and error details
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePaneMessage(
  message: PaneMessage,
  schemas: Record<string, PaneMessageSchema>
): ValidationResult {
  const errors: string[] = [];

  // Validate basic structure
  if (!message.id || typeof message.id !== 'string') {
    errors.push('Message must have a valid id');
  }

  if (!message.type || !['info', 'action', 'data', 'error', 'query'].includes(message.type)) {
    errors.push(`Invalid message type: ${message.type}`);
  }

  if (!message.source || !['upload', 'map', 'analytics'].includes(message.source)) {
    errors.push(`Invalid message source: ${message.source}`);
  }

  if (!message.payload || typeof message.payload !== 'object') {
    errors.push('Message must have a payload object');
  }

  if (!message.timestamp || typeof message.timestamp !== 'number') {
    errors.push('Message must have a valid timestamp');
  }

  // Find schema by constructing message key
  const messageKey = findMessageKey(message, schemas);
  
  if (!messageKey) {
    // No specific schema found, but basic validation passed
    return { valid: errors.length === 0, errors };
  }

  const schema = schemas[messageKey];

  // Validate against schema
  if (schema.type !== message.type) {
    errors.push(`Message type mismatch: expected ${schema.type}, got ${message.type}`);
  }

  if (schema.source !== message.source) {
    errors.push(`Message source mismatch: expected ${schema.source}, got ${message.source}`);
  }

  // Validate required fields
  for (const field of schema.requiredFields) {
    if (!(field in message.payload)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a PaneMessage using the default MESSAGE_SCHEMAS
 * Convenience wrapper around validatePaneMessage
 * 
 * @param message - The message to validate
 * @returns Validation result with success flag and error details
 */
export function validateMessage(message: PaneMessage): ValidationResult {
  return validatePaneMessage(message, MESSAGE_SCHEMAS);
}

/**
 * Finds the message key by matching source and payload structure
 */
function findMessageKey(
  message: PaneMessage,
  schemas: Record<string, PaneMessageSchema>
): string | null {
  // Try to find exact match by checking payload fields
  for (const [key, schema] of Object.entries(schemas)) {
    if (schema.source !== message.source) continue;
    
    // Check if all required fields are present
    const hasAllRequired = schema.requiredFields.every(
      field => field in message.payload
    );
    
    if (hasAllRequired) {
      return key;
    }
  }
  
  return null;
}

// ── Message Logging ───────────────────────────────────────────────────────────

/**
 * Logging configuration
 */
interface LogConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  includePayload: boolean;
  includeTimestamp: boolean;
}

const defaultLogConfig: LogConfig = {
  enabled: process.env.NODE_ENV === 'development',
  logLevel: 'debug',
  includePayload: true,
  includeTimestamp: true,
};

let logConfig: LogConfig = { ...defaultLogConfig };

/**
 * Configures message logging behavior
 */
export function configureMessageLogging(config: Partial<LogConfig>): void {
  logConfig = { ...logConfig, ...config };
}

/**
 * Logs a PaneMessage dispatch for debugging
 * 
 * @param message - The message being dispatched
 * @param context - Optional context information
 */
export function logPaneMessage(message: PaneMessage, context?: string): void {
  if (!logConfig.enabled) return;

  const prefix = context ? `[PaneMessage:${context}]` : '[PaneMessage]';
  const timestamp = logConfig.includeTimestamp
    ? new Date(message.timestamp).toISOString()
    : '';

  const logData = {
    id: message.id,
    type: message.type,
    source: message.source,
    ...(logConfig.includeTimestamp && { timestamp }),
    ...(logConfig.includePayload && { payload: message.payload }),
    ...(message.metadata && { metadata: message.metadata }),
  };

  switch (logConfig.logLevel) {
    case 'debug':
      console.debug(prefix, logData);
      break;
    case 'info':
      console.info(prefix, logData);
      break;
    case 'warn':
      console.warn(prefix, logData);
      break;
    case 'error':
      console.error(prefix, logData);
      break;
  }
}

/**
 * Logs a message validation failure
 */
export function logValidationError(message: PaneMessage, errors: string[]): void {
  if (!logConfig.enabled) return;

  console.error('[PaneMessage:Validation]', {
    messageId: message.id,
    source: message.source,
    type: message.type,
    errors,
    payload: message.payload,
  });
}

/**
 * Logs message dispatch statistics (useful for debugging performance)
 */
export function logMessageStats(messages: PaneMessage[]): void {
  if (!logConfig.enabled) return;

  const stats = {
    total: messages.length,
    bySource: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    avgTimeBetween: 0,
  };

  messages.forEach((msg) => {
    stats.bySource[msg.source] = (stats.bySource[msg.source] || 0) + 1;
    stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
  });

  if (messages.length > 1) {
    const timestamps = messages.map((m) => m.timestamp).sort((a, b) => a - b);
    const diffs = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    stats.avgTimeBetween = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  console.info('[PaneMessage:Stats]', stats);
}

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Checks if a message requires a response from the agent
 */
export function requiresResponse(message: PaneMessage): boolean {
  return message.metadata?.requiresResponse ?? false;
}

/**
 * Checks if a message was initiated by user action
 */
export function isUserInitiated(message: PaneMessage): boolean {
  return message.metadata?.userInitiated ?? false;
}

/**
 * Formats a message for display in the conversation stream
 */
export function formatMessageForDisplay(message: PaneMessage): string {
  const { source, type, payload } = message;

  // Format based on source and type
  switch (source) {
    case 'upload':
      if (type === 'data' && 'fishCount' in payload) {
        return `Uploaded ${payload.imageCount} images. Detected ${payload.fishCount} fish (${payload.topSpecies}).`;
      }
      if (type === 'info' && 'progress' in payload) {
        return `Uploading ${payload.fileName}... ${payload.progress}%`;
      }
      break;

    case 'map':
      if (type === 'query' && 'latitude' in payload) {
        return `Clicked location: ${(payload as any).latitude.toFixed(4)}°N, ${(payload as any).longitude.toFixed(4)}°E`;
      }
      if (type === 'query' && 'imageId' in payload) {
        return `Viewing catch: ${(payload as any).species || 'Unknown species'} at ${(payload as any).latitude.toFixed(4)}°N`;
      }
      break;

    case 'analytics':
      if (type === 'query' && 'chartType' in payload) {
        return `Clicked ${(payload as any).chartType} chart: ${(payload as any).dataPoint.label} (${(payload as any).dataPoint.value})`;
      }
      if (type === 'info' && 'totalCatches' in payload) {
        return `Loaded analytics: ${(payload as any).totalCatches} catches, ₹${(payload as any).totalEarnings} earnings`;
      }
      break;
  }

  // Fallback to generic format
  return `${source} ${type}: ${JSON.stringify(payload)}`;
}

/**
 * Sanitizes message payload for safe logging (removes sensitive data)
 */
export function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  const sanitized = { ...payload };
  
  // Remove potentially sensitive fields
  const sensitiveFields = ['token', 'password', 'apiKey', 'secret'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
