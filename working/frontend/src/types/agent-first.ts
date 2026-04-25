/**
 * Core type definitions for Agent-First Split-Pane Architecture
 */

import type { ComponentCache } from '@/lib/stores/component-cache';

// ── Component Types ───────────────────────────────────────────────────────────

export type ComponentType = 'upload' | 'map' | 'analytics' | 'history' | null;

export type ComponentStateType = 'idle' | 'loading' | 'active' | 'error';

export interface ComponentState {
  type: ComponentStateType;
  component: ComponentType;
  progress?: number;
  error?: Error;
}

export interface ComponentProps {
  onPaneMessage?: (message: PaneMessage) => void;
  [key: string]: any;
}

export interface ComponentHistoryEntry {
  component: ComponentType;
  props: ComponentProps;
  timestamp: number;
}

// ── Pane Message Types ────────────────────────────────────────────────────────

export type PaneMessageType = 'info' | 'action' | 'data' | 'error' | 'query';

export type PaneMessageSource = 'upload' | 'map' | 'analytics' | 'history';

export interface PaneMessage {
  id: string;
  type: PaneMessageType;
  source: PaneMessageSource;
  payload: Record<string, any>;
  timestamp: number;
  metadata?: {
    userInitiated: boolean;
    requiresResponse: boolean;
  };
}

// ── Store State Types ─────────────────────────────────────────────────────────

export interface PaneWidths {
  agent: number;
  canvas: number;
}

export interface CachedComponent {
  props: ComponentProps;
  state: any;
  timestamp: number;
}

export interface SessionState {
  version: string;
  timestamp: number;
  conversationHistory: any[];
  currentChatId: string | null;
  activeComponent: ComponentType | null;
  componentProps: ComponentProps;
  componentCache: Record<string, CachedComponent>;
  paneWidths: PaneWidths;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  voiceEnabled: boolean;
  autoPlayTTS: boolean;
}

// ── Zustand Store Interface ───────────────────────────────────────────────────

export interface AgentFirstStore {
  // Active component state
  activeComponent: ComponentType | null;
  componentProps: ComponentProps;
  componentHistory: ComponentHistoryEntry[];
  componentState: ComponentState;

  // Pane layout state
  paneWidths: PaneWidths;
  isDraggingDivider: boolean;
  isFullscreen: boolean;

  // Communication state
  paneMessages: PaneMessage[];
  pendingMessages: PaneMessage[];

  // UI state
  isMobile: boolean;
  isDrawerOpen: boolean;
  isVoiceActive: boolean;
  isOffline: boolean;

  // Session state
  conversationHistory: any[];
  currentChatId: string | null;

  // Component cache
  componentCache: ComponentCache;

  // Actions
  setActiveComponent: (type: ComponentType, props?: ComponentProps) => void;
  clearComponent: () => void;
  goBack: () => void;
  setPaneWidths: (widths: PaneWidths) => void;
  dispatchPaneMessage: (message: PaneMessage) => void;
  clearProcessedMessages: (messageIds: string[]) => void;
  toggleDrawer: (open: boolean) => void;
  setVoiceActive: (active: boolean) => void;
  setOffline: (offline: boolean) => void;
  setConversationHistory: (history: any[]) => void;
  setChatId: (chatId: string | null) => void;
  restoreSession: (state: Partial<SessionState>) => void;
  persistSession: () => void;
  logout: () => void;
}

// ── Animation Types ───────────────────────────────────────────────────────────

export interface AnimationConfig {
  duration: number;
  ease: string;
  delay?: number;
}

export interface TransitionVariants {
  initial: any;
  animate: any;
  exit: any;
}
