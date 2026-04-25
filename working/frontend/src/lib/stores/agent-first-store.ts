/**
 * Zustand store for Agent-First Split-Pane Architecture
 * Manages active component, pane layout, communication, and session state
 */

import { create } from 'zustand';
import { ComponentCache } from './component-cache';
import { saveSession, clearSessionOnLogout } from './session-manager';
import type {
  AgentFirstStore,
  ComponentType,
  ComponentProps,
  ComponentHistoryEntry,
  ComponentState,
  PaneWidths,
  PaneMessage,
  CachedComponent,
} from '@/types/agent-first';

// ── Default Values ────────────────────────────────────────────────────────────

const DEFAULT_PANE_WIDTHS: PaneWidths = {
  agent: 38, // 38% for agent pane
  canvas: 62, // 62% for canvas pane
};

// Cache expiration time: 5 minutes (in milliseconds)
const CACHE_EXPIRATION_MS = 5 * 60 * 1000;

const DEFAULT_STATE: Omit<AgentFirstStore, keyof ReturnType<typeof createActions>> = {
  activeComponent: null,
  componentProps: {},
  componentHistory: [],
  componentState: { type: 'idle', component: null },
  paneWidths: DEFAULT_PANE_WIDTHS,
  isDraggingDivider: false,
  isFullscreen: false,
  paneMessages: [],
  pendingMessages: [],
  isMobile: false,
  isDrawerOpen: false,
  isVoiceActive: false,
  isOffline: false,
  conversationHistory: [],
  currentChatId: null,
  componentCache: new ComponentCache(3),
};

// ── Store Actions ─────────────────────────────────────────────────────────────

function createActions(set: any, get: any) {
  return {
    setActiveComponent: (type: ComponentType, props: ComponentProps = {}) => {
      const current = get().activeComponent;
      const currentProps = get().componentProps;
      const cache = get().componentCache;
      
      // Cache current component state before switching (if not null)
      if (current !== null && current !== type) {
        const cachedData: CachedComponent = {
          props: currentProps,
          state: {}, // Component-specific state would be passed here
          timestamp: Date.now()
        };
        cache.set(current, cachedData);
      }
      
      // Check if returning to a cached component
      if (type !== null) {
        const cached = cache.get(type);
        
        // Restore cached state if within 5-minute window
        if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRATION_MS) {
          // Merge cached props with new props (new props take precedence)
          const mergedProps = { ...cached.props, ...props };
          
          set({
            activeComponent: type,
            componentProps: mergedProps,
            componentState: { type: 'active', component: type },
          });
          
          // Add to history if changing component
          if (current !== type && current !== null) {
            set((state: AgentFirstStore) => ({
              componentHistory: [
                ...state.componentHistory,
                {
                  component: current,
                  props: currentProps,
                  timestamp: Date.now(),
                },
              ].slice(-10), // Keep last 10 entries
            }));
          }
          
          return; // Early return - cached state restored
        }
      }
      
      // No cache hit or expired - proceed with normal component switch
      // Add to history if changing component
      if (current !== type && current !== null) {
        set((state: AgentFirstStore) => ({
          componentHistory: [
            ...state.componentHistory,
            {
              component: current,
              props: currentProps,
              timestamp: Date.now(),
            },
          ].slice(-10), // Keep last 10 entries
        }));
      }
      
      set({
        activeComponent: type,
        componentProps: props,
        componentState: { type: 'loading', component: type, progress: 0 },
      });
      
      // Simulate component load completion
      setTimeout(() => {
        if (get().activeComponent === type) {
          set({
            componentState: { type: 'active', component: type },
          });
        }
      }, 100);
    },

    clearComponent: () => {
      const current = get().activeComponent;
      const currentProps = get().componentProps;
      const cache = get().componentCache;
      
      // Cache current component state before clearing (if not null)
      if (current !== null) {
        const cachedData: CachedComponent = {
          props: currentProps,
          state: {},
          timestamp: Date.now()
        };
        cache.set(current, cachedData);
      }
      
      set({
        activeComponent: null,
        componentProps: {},
        componentState: { type: 'idle', component: null },
      });
    },

    goBack: () => {
      const history = get().componentHistory;
      const current = get().activeComponent;
      const currentProps = get().componentProps;
      const cache = get().componentCache;
      
      if (history.length === 0) {
        get().clearComponent();
        return;
      }
      
      // Cache current component state before going back (if not null)
      if (current !== null) {
        const cachedData: CachedComponent = {
          props: currentProps,
          state: {},
          timestamp: Date.now()
        };
        cache.set(current, cachedData);
      }
      
      const previous = history[history.length - 1];
      
      // Check if previous component has cached state
      const cached = cache.get(previous.component);
      
      // Use cached state if within 5-minute window, otherwise use history
      const propsToUse = cached && (Date.now() - cached.timestamp) < CACHE_EXPIRATION_MS
        ? { ...cached.props, ...previous.props }
        : previous.props;
      
      set((state: AgentFirstStore) => ({
        activeComponent: previous.component,
        componentProps: propsToUse,
        componentHistory: state.componentHistory.slice(0, -1),
        componentState: { type: 'active', component: previous.component },
      }));
    },

    setPaneWidths: (widths: PaneWidths) => {
      // Validate constraints
      const agentPercent = Math.max(25, Math.min(50, widths.agent));
      const canvasPercent = 100 - agentPercent;
      
      set({
        paneWidths: {
          agent: agentPercent,
          canvas: canvasPercent,
        },
      });
      
      // Persist to localStorage (debounced in component)
    },

    dispatchPaneMessage: (message: PaneMessage) => {
      const isOffline = get().isOffline;
      
      if (isOffline) {
        // Queue message for later
        set((state: AgentFirstStore) => ({
          pendingMessages: [...state.pendingMessages, message],
        }));
      } else {
        // Process immediately
        set((state: AgentFirstStore) => ({
          paneMessages: [...state.paneMessages, message],
        }));
      }
    },

    clearProcessedMessages: (messageIds: string[]) => {
      set((state: AgentFirstStore) => ({
        paneMessages: state.paneMessages.filter(
          (msg) => !messageIds.includes(msg.id)
        ),
      }));
    },

    toggleDrawer: (open: boolean) => {
      set({ isDrawerOpen: open });
    },

    setVoiceActive: (active: boolean) => {
      set({ isVoiceActive: active });
    },

    setOffline: (offline: boolean) => {
      const wasOffline = get().isOffline;
      set({ isOffline: offline });
      
      // Flush pending messages when coming back online
      if (wasOffline && !offline) {
        const pending = get().pendingMessages;
        if (pending.length > 0) {
          set((state: AgentFirstStore) => ({
            paneMessages: [...state.paneMessages, ...pending],
            pendingMessages: [],
          }));
        }
      }
    },

    setConversationHistory: (history: any[]) => {
      set({ conversationHistory: history });
    },

    setChatId: (chatId: string | null) => {
      set({ currentChatId: chatId });
    },

    restoreSession: (state: Partial<any>) => {
      set({
        conversationHistory: state.conversationHistory || [],
        currentChatId: state.currentChatId || null,
        activeComponent: state.activeComponent || null,
        componentProps: state.componentProps || {},
        paneWidths: state.paneWidths || DEFAULT_PANE_WIDTHS,
      });
    },

    persistSession: () => {
      const state = get();
      
      saveSession(
        state.conversationHistory,
        state.currentChatId,
        state.activeComponent,
        state.componentProps,
        state.paneWidths
      );
    },

    logout: () => {
      // Clear session storage
      clearSessionOnLogout();
      
      // Reset store to default state
      set({
        ...DEFAULT_STATE,
        componentCache: new ComponentCache(3), // Create new cache instance
      });
    },
  };
}

// ── Store Creation ────────────────────────────────────────────────────────────

export const useAgentFirstStore = create<AgentFirstStore>((set, get) => ({
  ...DEFAULT_STATE,
  ...createActions(set, get),
}));

// ── Automatic Session Persistence ─────────────────────────────────────────────

let persistTimer: NodeJS.Timeout | null = null;

/**
 * Debounced session persistence
 * Writes to sessionStorage after 500ms of inactivity
 */
function debouncedPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  
  persistTimer = setTimeout(() => {
    const state = useAgentFirstStore.getState();
    
    saveSession(
      state.conversationHistory,
      state.currentChatId,
      state.activeComponent,
      state.componentProps,
      state.paneWidths
    );
  }, 500);
}

/**
 * Subscribe to critical state changes and persist automatically
 * Monitors: activeComponent, componentProps, conversationHistory, currentChatId, paneWidths
 */
useAgentFirstStore.subscribe((state, prevState) => {
  // Check if any critical state has changed
  const criticalStateChanged =
    state.activeComponent !== prevState.activeComponent ||
    state.componentProps !== prevState.componentProps ||
    state.conversationHistory !== prevState.conversationHistory ||
    state.currentChatId !== prevState.currentChatId ||
    state.paneWidths !== prevState.paneWidths;
  
  if (criticalStateChanged) {
    debouncedPersist();
  }
});

// ── Selectors for Performance ─────────────────────────────────────────────────

export const selectActiveComponent = (state: AgentFirstStore) => state.activeComponent;
export const selectComponentState = (state: AgentFirstStore) => state.componentState;
export const selectPaneWidths = (state: AgentFirstStore) => state.paneWidths;
export const selectIsDrawerOpen = (state: AgentFirstStore) => state.isDrawerOpen;
export const selectIsOffline = (state: AgentFirstStore) => state.isOffline;
export const selectPaneMessages = (state: AgentFirstStore) => state.paneMessages;
