/**
 * useSessionRestore - Hook for restoring session state on page load
 * Handles browser refresh recovery with graceful error handling
 */

import { useEffect, useState } from 'react';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import { loadSession, isSessionStorageAvailable } from '@/lib/stores/session-manager';
import { toast } from 'sonner';

interface SessionRestoreResult {
  isRestoring: boolean;
  isRestored: boolean;
  hasSession: boolean;
}

/**
 * Hook to restore session state from sessionStorage on mount
 * 
 * @returns Object with restoration status flags
 */
export function useSessionRestore(): SessionRestoreResult {
  const [isRestoring, setIsRestoring] = useState(true);
  const [isRestored, setIsRestored] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  
  const restoreSession = useAgentFirstStore((state) => state.restoreSession);

  useEffect(() => {
    // Check if sessionStorage is available
    if (!isSessionStorageAvailable()) {
      console.warn('[Session] sessionStorage not available');
      setIsRestoring(false);
      return;
    }

    // Attempt to load session
    const startTime = performance.now();
    
    try {
      const sessionState = loadSession();
      
      if (sessionState) {
        setHasSession(true);
        
        // Restore state to store
        restoreSession(sessionState);
        
        const duration = performance.now() - startTime;
        console.log(`[Session] Restored in ${duration.toFixed(2)}ms`);
        
        // Show subtle notification if restoration took significant time
        if (duration < 500) {
          setIsRestored(true);
          
          // Show notification after a brief delay
          setTimeout(() => {
            toast.success('Session restored', {
              duration: 2000,
              description: 'Your conversation has been recovered',
            });
          }, 100);
        }
      } else {
        console.log('[Session] No session to restore');
      }
    } catch (error) {
      console.error('[Session] Restoration failed:', error);
      toast.error('Failed to restore session', {
        description: 'Starting with a fresh session',
      });
    } finally {
      setIsRestoring(false);
    }
  }, [restoreSession]);

  return {
    isRestoring,
    isRestored,
    hasSession,
  };
}
