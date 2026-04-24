"use client"

import React, { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentFirstStore, selectIsOffline, selectPaneMessages } from '@/lib/stores/agent-first-store';
import AgentChat from '@/components/AgentChat';
import { useLanguage } from '@/lib/i18n';
import { useSessionRestore } from '@/lib/hooks/useSessionRestore';
import { formatMessageForDisplay } from '@/lib/utils/pane-message';
import type { PaneMessage } from '@/types/agent-first';
import { useAgentContext } from '@/lib/stores/agent-context-store';

interface AgentInterfacePaneProps {
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * AgentInterfacePane - The persistent left pane containing the AI agent interface
 * 
 * Features:
 * - Header with branding and status indicators
 * - Conversation stream using AgentChat component
 * - Scroll position preservation across component changes
 * - Offline indicator
 * - Glassmorphism oceanic theme
 */
export default function AgentInterfacePane({
  variant = 'full',
  className,
}: AgentInterfacePaneProps) {
  const { t } = useLanguage();
  const isOffline = useAgentFirstStore(selectIsOffline);
  const paneMessages = useAgentFirstStore(selectPaneMessages);
  const activeComponent = useAgentFirstStore((state) => state.activeComponent);
  const componentProps = useAgentFirstStore((state) => state.componentProps);
  const currentChatId = useAgentFirstStore((state) => state.currentChatId);
  const conversationHistory = useAgentFirstStore((state) => state.conversationHistory);
  const setChatId = useAgentFirstStore((state) => state.setChatId);
  const setConversationHistory = useAgentFirstStore((state) => state.setConversationHistory);
  const persistSession = useAgentFirstStore((state) => state.persistSession);
  const clearProcessedMessages = useAgentFirstStore((state) => state.clearProcessedMessages);

  // Restore session on mount
  const { isRestoring, isRestored, hasSession } = useSessionRestore();

  // Scroll position preservation
  const scrollPositionRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce timer for session persistence
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track processed PaneMessages to avoid duplicates
  const processedMessagesRef = useRef<Set<string>>(new Set());

  const selectedContextGroupId =
    (activeComponent === 'history' || activeComponent === 'upload')
      ? (componentProps?.selectedGroupId ?? componentProps?.currentGroupId ?? null)
      : null;

  // ── Clear global agent context when closing panes ──────────────────────────
  useEffect(() => {
    if (!activeComponent) {
      useAgentContext.getState().resetContext();
    }
  }, [activeComponent]);

  // ── Preserve scroll position across component changes ──────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      scrollPositionRef.current = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Restore scroll position when returning to this pane ────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Restore scroll position after a brief delay to allow content to render
    const timer = setTimeout(() => {
      container.scrollTop = scrollPositionRef.current;
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // ── Handle chat ID changes ─────────────────────────────────────────────────
  const handleChatIdChange = useCallback((chatId: string) => {
    setChatId(chatId);

    // Persist session when chat ID changes (debounced)
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistSession();
    }, 500);
  }, [setChatId, persistSession]);

  // ── Sync conversation history from AgentChat to store ──────────────────────
  const handleConversationUpdate = useCallback((messages: any[]) => {
    setConversationHistory(messages);

    // Persist session when conversation updates (debounced)
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistSession();
    }, 500);
  }, [setConversationHistory, persistSession]);

  // ── Cleanup debounce timer ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  // ── Process PaneMessages and inject into conversation ──────────────────────
  useEffect(() => {
    // Process new PaneMessages
    const newMessages = paneMessages.filter(
      (msg) => !processedMessagesRef.current.has(msg.id)
    );

    if (newMessages.length === 0) return;

    // Track acknowledgment timing for performance monitoring
    const startTime = performance.now();

    // Convert PaneMessages to conversation messages
    const conversationMessages = newMessages.map((paneMsg) => {
      // Mark as processed
      processedMessagesRef.current.add(paneMsg.id);

      // Format message content based on type and payload
      const content = formatMessageForDisplay(paneMsg);

      // Create conversation message with PaneMessage metadata
      return {
        id: paneMsg.id,
        role: 'user' as const,
        content,
        timestamp: new Date(paneMsg.timestamp),
        isPaneMessage: true,
        paneSource: paneMsg.source,
      };
    });

    // Inject messages into conversation history
    if (conversationMessages.length > 0) {
      const updatedHistory = [...conversationHistory, ...conversationMessages];
      setConversationHistory(updatedHistory);

      // Persist session after message injection (debounced)
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = setTimeout(() => {
        persistSession();
      }, 500);

      // Log acknowledgment timing (should be < 100ms)
      const ackTime = performance.now() - startTime;
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `[AgentInterfacePane] Acknowledged ${conversationMessages.length} PaneMessage(s) in ${ackTime.toFixed(2)}ms`
        );
      }

      // Warn if acknowledgment exceeds 100ms threshold
      if (ackTime > 100) {
        console.warn(
          `[AgentInterfacePane] PaneMessage acknowledgment exceeded 100ms threshold: ${ackTime.toFixed(2)}ms`
        );
      }

      // Clear processed messages from store after a delay to prevent memory leaks
      // Keep messages for 5 seconds to allow for any race conditions
      setTimeout(() => {
        const messageIds = newMessages.map((msg) => msg.id);
        clearProcessedMessages(messageIds);
      }, 5000);
    }
  }, [paneMessages, conversationHistory, setConversationHistory, persistSession, clearProcessedMessages]);

  // ── Offline detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      useAgentFirstStore.getState().setOffline(false);
    };

    const handleOffline = () => {
      useAgentFirstStore.getState().setOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      useAgentFirstStore.getState().setOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full w-full",
        "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
        "border-r border-border/20",
        className
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "shrink-0 px-4 py-3 border-b border-border/20",
          "bg-card/30 backdrop-blur-md"
        )}
      >
        <div className="flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                MatsyaAI
              </h2>
              <p className="text-[10px] text-muted-foreground/60 leading-tight">
                Your AI Fishing Assistant
              </p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {/* Offline Indicator */}
            {isOffline && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 whitespace-nowrap"
              >
                <WifiOff className="w-3 h-3 text-red-500" />
                <span className="text-[10px] font-medium text-red-500">
                  Offline
                </span>
              </motion.div>
            )}

            {/* Online Indicator (subtle) */}
            {!isOffline && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                <Wifi className="w-3 h-3 text-emerald-500/70" />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Conversation Stream ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {isRestoring ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Restoring session...</p>
            </div>
          </div>
        ) : (
          <AgentChat
            variant="compact"
            chatId={currentChatId}
            contextGroupId={selectedContextGroupId}
            onChatIdChange={handleChatIdChange}
            initialMessages={conversationHistory}
            onMessagesChange={handleConversationUpdate}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
