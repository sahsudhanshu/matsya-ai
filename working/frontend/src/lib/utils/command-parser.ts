/**
 * Command parser with intent detection for agent commands
 * Provides fast-path client-side pattern matching with fallback to LangGraph backend
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type { ComponentType } from '@/types/agent-first';

// ── Intent Detection Types ────────────────────────────────────────────────────

export interface CommandIntent {
  action: 'open' | 'close' | 'query' | 'navigate';
  target: ComponentType | null;
  params?: Record<string, unknown>;
  confidence: number;
}

// ── Command Pattern Definitions ───────────────────────────────────────────────

/**
 * Client-side pattern matching for fast intent detection
 * Each component has multiple regex patterns for natural language variations
 */
export const COMMAND_PATTERNS: Record<string, RegExp[]> = {
  upload: [
    /upload|camera|photo|picture|image|scan|analyze/i,
    /catch|fish.*photo/i,
    /take.*picture|capture.*image/i,
    /add.*catch|record.*catch/i,
  ],
  map: [
    /map|location|where|coordinates|ocean.*data/i,
    /show.*map|view.*map|open.*map/i,
    /navigation|navigate|find.*location/i,
    /sea.*conditions|water.*temp/i,
  ],
  analytics: [
    /analytics|stats|statistics|report|dashboard/i,
    /earnings|revenue|performance|income/i,
    /show.*data|view.*analytics|open.*analytics/i,
    /catch.*history|fishing.*data/i,
  ],
  close: [
    /close|hide|dismiss|back|exit/i,
    /go.*back|return/i,
  ],
};

// ── Confidence Thresholds ─────────────────────────────────────────────────────

const HIGH_CONFIDENCE = 0.9;
const MEDIUM_CONFIDENCE = 0.7;
const LOW_CONFIDENCE = 0.5;

// ── Intent Detection Functions ────────────────────────────────────────────────

/**
 * Detect intent from user message using pattern matching
 * Returns null if no pattern matches (fallback to backend NLU)
 * 
 * @param message - User's natural language command
 * @returns CommandIntent or null if no match
 */
export function detectIntent(message: string): CommandIntent | null {
  if (!message || message.trim().length === 0) {
    return null;
  }

  const normalizedMessage = message.trim().toLowerCase();

  // Check close patterns first (highest priority)
  if (matchesPatterns(normalizedMessage, COMMAND_PATTERNS.close)) {
    return {
      action: 'close',
      target: null,
      confidence: HIGH_CONFIDENCE,
    };
  }

  // Check component patterns
  for (const [component, patterns] of Object.entries(COMMAND_PATTERNS)) {
    if (component === 'close') continue; // Already handled

    const matchResult = matchesPatterns(normalizedMessage, patterns);
    if (matchResult) {
      return {
        action: 'open',
        target: component as ComponentType,
        confidence: calculateConfidence(normalizedMessage, patterns),
      };
    }
  }

  // No pattern match - return null for backend fallback
  return null;
}

/**
 * Check if message matches any of the provided patterns
 */
function matchesPatterns(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

/**
 * Calculate confidence score based on pattern matches
 * Higher confidence for exact matches, lower for partial matches
 */
function calculateConfidence(message: string, patterns: RegExp[]): number {
  let matchCount = 0;
  let exactMatch = false;

  for (const pattern of patterns) {
    if (pattern.test(message)) {
      matchCount++;
      
      // Check if it's an exact match (entire message matches)
      const match = message.match(pattern);
      if (match && match[0].length === message.length) {
        exactMatch = true;
      }
    }
  }

  // Exact match = high confidence
  if (exactMatch) {
    return HIGH_CONFIDENCE;
  }

  // Multiple pattern matches = medium confidence
  if (matchCount > 1) {
    return MEDIUM_CONFIDENCE;
  }

  // Single pattern match = low-medium confidence
  if (matchCount === 1) {
    return LOW_CONFIDENCE + 0.2;
  }

  return LOW_CONFIDENCE;
}

/**
 * Extract parameters from command message
 * Used for commands with additional context (e.g., "show map near Mumbai")
 */
export function extractParams(message: string, target: ComponentType): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (!target) return params;

  const normalizedMessage = message.toLowerCase();

  // Extract location for map commands
  if (target === 'map') {
    const locationMatch = normalizedMessage.match(/near\s+(\w+)|at\s+(\w+)|in\s+(\w+)/);
    if (locationMatch) {
      params.location = locationMatch[1] || locationMatch[2] || locationMatch[3];
    }

    // Extract layer preferences
    if (normalizedMessage.includes('temperature') || normalizedMessage.includes('temp')) {
      params.layer = 'temperature';
    } else if (normalizedMessage.includes('current')) {
      params.layer = 'currents';
    } else if (normalizedMessage.includes('depth')) {
      params.layer = 'depth';
    }
  }

  // Extract date range for analytics commands
  if (target === 'analytics') {
    if (normalizedMessage.includes('today')) {
      params.dateRange = 'today';
    } else if (normalizedMessage.includes('week')) {
      params.dateRange = 'week';
    } else if (normalizedMessage.includes('month')) {
      params.dateRange = 'month';
    } else if (normalizedMessage.includes('year')) {
      params.dateRange = 'year';
    }

    // Extract species filter
    const speciesMatch = normalizedMessage.match(/for\s+(\w+)|about\s+(\w+)/);
    if (speciesMatch) {
      params.species = speciesMatch[1] || speciesMatch[2];
    }
  }

  return params;
}

/**
 * Parse command and return intent with parameters
 * Main entry point for command parsing
 */
export function parseCommand(message: string): CommandIntent | null {
  const intent = detectIntent(message);
  
  if (!intent) {
    return null;
  }

  // Extract additional parameters if target component identified
  if (intent.target) {
    intent.params = extractParams(message, intent.target);
  }

  return intent;
}

/**
 * Check if confidence is high enough for client-side routing
 * Low confidence commands should be sent to backend for better NLU
 */
export function isHighConfidence(intent: CommandIntent): boolean {
  return intent.confidence >= MEDIUM_CONFIDENCE;
}

/**
 * Format intent for logging and debugging
 */
export function formatIntent(intent: CommandIntent): string {
  return `[${intent.action}] ${intent.target || 'none'} (confidence: ${(intent.confidence * 100).toFixed(0)}%)`;
}
