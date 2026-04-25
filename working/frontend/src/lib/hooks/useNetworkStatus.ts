/**
 * useNetworkStatus hook for network connectivity monitoring
 * Uses navigator.onLine API and periodic connectivity checks
 * 
 * Requirements: 2.4, 12.3, 12.4, 12.6
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';

// ── Configuration ─────────────────────────────────────────────────────────────

const CONNECTIVITY_CHECK_INTERVAL = 30000; // 30 seconds
const CONNECTIVITY_CHECK_TIMEOUT = 5000; // 5 seconds
const CONNECTIVITY_CHECK_URL = '/api/health'; // Endpoint to check connectivity

// ── Network Status Hook ───────────────────────────────────────────────────────

export function useNetworkStatus() {
  const setOffline = useAgentFirstStore((state) => state.setOffline);
  const isOffline = useAgentFirstStore((state) => state.isOffline);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check actual network connectivity by making a request
   * navigator.onLine can be unreliable, so we verify with an actual request
   */
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT);

      const response = await fetch(CONNECTIVITY_CHECK_URL, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Network error or timeout
      return false;
    }
  }, []);

  /**
   * Handle online event
   */
  const handleOnline = useCallback(async () => {
    // Verify connectivity before marking as online
    const isConnected = await checkConnectivity();
    
    if (isConnected) {
      setOffline(false);
    }
  }, [checkConnectivity, setOffline]);

  /**
   * Handle offline event
   */
  const handleOffline = useCallback(() => {
    setOffline(true);
  }, [setOffline]);

  /**
   * Periodic connectivity check
   */
  const performPeriodicCheck = useCallback(async () => {
    const isConnected = await checkConnectivity();
    const currentlyOffline = !navigator.onLine || !isConnected;

    if (currentlyOffline !== isOffline) {
      setOffline(currentlyOffline);
    }
  }, [checkConnectivity, isOffline, setOffline]);

  // Setup network monitoring
  useEffect(() => {
    // Initial check
    const initialCheck = async () => {
      const isConnected = navigator.onLine && (await checkConnectivity());
      setOffline(!isConnected);
    };

    initialCheck();

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start periodic checks
    checkIntervalRef.current = setInterval(
      performPeriodicCheck,
      CONNECTIVITY_CHECK_INTERVAL
    );

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [handleOnline, handleOffline, performPeriodicCheck, checkConnectivity, setOffline]);

  return {
    isOffline,
    checkConnectivity,
  };
}

/**
 * Hook to disable/enable features based on network status
 */
export function useNetworkFeatures() {
  const isOffline = useAgentFirstStore((state) => state.isOffline);

  return {
    isOffline,
    // Network-dependent features (disabled when offline)
    canUseAI: !isOffline,
    canFetchData: !isOffline,
    canUpload: !isOffline,
    canSync: !isOffline,
    // Cached features (enabled when offline)
    canViewHistory: true,
    canViewCachedMaps: true,
    canViewCachedAnalytics: true,
  };
}
