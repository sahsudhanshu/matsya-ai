/**
 * OfflineIndicator component
 * Displays network connectivity status in agent header
 * 
 * Requirements: 12.1, 12.2, 12.8
 */

'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import { cn } from '@/lib/utils';

export interface OfflineIndicatorProps {
  className?: string;
  isCompact?: boolean;
}

export function OfflineIndicator({ className = '', isCompact = false }: OfflineIndicatorProps) {
  const isOffline = useAgentFirstStore((state) => state.isOffline);
  const [showReconnected, setShowReconnected] = useState(false);

  // Handle reconnection message
  useEffect(() => {
    if (!isOffline && showReconnected) {
      // Fade out after 3 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOffline, showReconnected]);

  // Track when we go from offline to online
  useEffect(() => {
    if (!isOffline) {
      setShowReconnected(true);
    }
  }, [isOffline]);

  return (
    <AnimatePresence mode="wait">
      {isOffline && (
        <motion.div
          key="offline"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn("flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20", isCompact ? "justify-center p-1.5 w-8 h-8 rounded-xl" : "px-3 py-1.5", className)}
          role="status"
          aria-live="polite"
          title={isCompact ? "Offline" : undefined}
        >
          <WifiOff className={cn("text-red-500 shrink-0", isCompact ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
          {!isCompact && (
            <span className="text-sm text-red-500 font-medium whitespace-nowrap">
              Offline
            </span>
          )}
        </motion.div>
      )}

      {!isOffline && showReconnected && (
        <motion.div
          key="reconnected"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn("flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20", isCompact ? "justify-center p-1.5 w-8 h-8 rounded-xl" : "px-3 py-1.5", className)}
          role="status"
          aria-live="polite"
          title={isCompact ? "Back online" : undefined}
        >
          <Wifi className={cn("text-emerald-500 shrink-0", isCompact ? "w-4 h-4" : "w-4 h-4")} aria-hidden="true" />
          {!isCompact && (
            <span className="text-sm text-emerald-500 font-medium whitespace-nowrap">
              Back online
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
