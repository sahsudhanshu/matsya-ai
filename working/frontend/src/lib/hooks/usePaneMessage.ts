/**
 * usePaneMessage hook for ContentCanvas components
 * 
 * Provides a dispatch function for child components (Upload, Map, Analytics)
 * to send PaneMessages to the AgentInterfacePane. Integrates with the
 * agent-first-store and uses message utilities from pane-message.ts.
 * 
 * Requirements: 30.2
 * 
 * @example
 * ```tsx
 * function MapComponent() {
 *   const dispatch = usePaneMessage('map');
 *   
 *   const handleMapClick = (lat: number, lng: number) => {
 *     dispatch(createMapClickMessage(lat, lng));
 *   };
 *   
 *   return <div onClick={() => handleMapClick(19.07, 72.87)}>...</div>;
 * }
 * ```
 */

import { useCallback } from 'react';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import type { PaneMessage, PaneMessageSource } from '@/types/agent-first';
import {
  validateMessage,
  logPaneMessage,
  logValidationError,
} from '@/lib/utils/pane-message';

// ── Hook Interface ────────────────────────────────────────────────────────────

export interface UsePaneMessageOptions {
  /**
   * Whether to validate messages before dispatching
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to log messages for debugging
   * @default true in development, false in production
   */
  log?: boolean;

  /**
   * Custom error handler for validation failures
   */
  onValidationError?: (message: PaneMessage, errors: string[]) => void;
}

export type DispatchPaneMessage = (message: PaneMessage) => void;

// ── Hook Implementation ───────────────────────────────────────────────────────

/**
 * Hook for dispatching PaneMessages from ContentCanvas components
 * 
 * @param source - The component source (upload, map, analytics)
 * @param options - Configuration options
 * @returns A dispatch function for sending messages
 */
export function usePaneMessage(
  source: PaneMessageSource,
  options: UsePaneMessageOptions = {}
): DispatchPaneMessage {
  const {
    validate = true,
    log = process.env.NODE_ENV === 'development',
    onValidationError,
  } = options;

  const dispatchPaneMessage = useAgentFirstStore((state) => state.dispatchPaneMessage);

  const dispatch = useCallback(
    (message: PaneMessage) => {
      // Verify message source matches hook source
      if (message.source !== source) {
        console.error(
          `[usePaneMessage] Source mismatch: expected "${source}", got "${message.source}"`
        );
        return;
      }

      // Validate message if enabled
      if (validate) {
        const validation = validateMessage(message);
        
        if (!validation.valid) {
          logValidationError(message, validation.errors);
          
          if (onValidationError) {
            onValidationError(message, validation.errors);
          }
          
          // Don't dispatch invalid messages
          return;
        }
      }

      // Log message if enabled
      if (log) {
        logPaneMessage(message, source);
      }

      // Dispatch to store
      dispatchPaneMessage(message);
    },
    [source, validate, log, onValidationError, dispatchPaneMessage]
  );

  return dispatch;
}

// ── Convenience Hooks for Specific Components ─────────────────────────────────

/**
 * Hook for dispatching messages from UploadComponent
 */
export function useUploadMessage(options?: UsePaneMessageOptions): DispatchPaneMessage {
  return usePaneMessage('upload', options);
}

/**
 * Hook for dispatching messages from MapComponent
 */
export function useMapMessage(options?: UsePaneMessageOptions): DispatchPaneMessage {
  return usePaneMessage('map', options);
}

/**
 * Hook for dispatching messages from AnalyticsComponent
 */
export function useAnalyticsMessage(options?: UsePaneMessageOptions): DispatchPaneMessage {
  return usePaneMessage('analytics', options);
}
