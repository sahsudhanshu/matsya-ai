/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Session Manager - Handles serialization/deserialization of session state
 * Provides browser refresh recovery for conversation history and app state
 */

import type { SessionState, ComponentType, ComponentProps, PaneWidths } from '@/types/agent-first';

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'matsyaai_agent_session';
const SESSION_VERSION = '1.0.0';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Message Interface (matching AgentChat) ────────────────────────────────────

export interface SerializableMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string for serialization
  status?: 'sending' | 'sent' | 'failed';
}

// ── Session Serialization ─────────────────────────────────────────────────────

/**
 * Serialize current session state to JSON string
 */
export function serializeSession(
  conversationHistory: any[],
  currentChatId: string | null,
  activeComponent: ComponentType | null,
  componentProps: ComponentProps,
  paneWidths: PaneWidths
): string {
  // Convert messages to serializable format
  const serializableMessages: SerializableMessage[] = (conversationHistory as any[]).map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    status: msg.status,
  }));

  const sessionState: SessionState = {
    version: SESSION_VERSION,
    timestamp: Date.now(),
    conversationHistory: serializableMessages,
    currentChatId,
    activeComponent,
    componentProps,
    componentCache: {}, // Cache handled separately
    paneWidths,
    preferences: {
      language: 'en', // TODO: Get from i18n context
      voiceEnabled: true,
      autoPlayTTS: false,
    },
  };

  return JSON.stringify(sessionState);
}

/**
 * Deserialize session state from JSON string
 * Returns null if deserialization fails or session is too old
 */
export function deserializeSession(json: string): Partial<SessionState> | null {
  try {
    const state: SessionState = JSON.parse(json);

    // Validate version
    if (state.version !== SESSION_VERSION) {
      console.warn('[Session] Version mismatch, attempting migration');
      return migrateSession(state);
    }

    // Check session age
    const age = Date.now() - state.timestamp;
    if (age > SESSION_MAX_AGE_MS) {
      console.warn('[Session] Session expired (age:', age, 'ms)');
      return null;
    }

    // Convert ISO strings back to Date objects
    const conversationHistory = state.conversationHistory.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));

    return {
      conversationHistory,
      currentChatId: state.currentChatId,
      activeComponent: state.activeComponent,
      componentProps: state.componentProps,
      paneWidths: state.paneWidths,
    };
  } catch (error) {
    console.error('[Session] Failed to deserialize:', error);
    return null;
  }
}

/**
 * Migrate session from older versions
 */
function migrateSession(state: any): Partial<SessionState> | null {
  // For now, just return null to start fresh
  // In the future, add migration logic for version changes
  console.warn('[Session] No migration path available, starting fresh');
  return null;
}

// ── Session Storage Operations ────────────────────────────────────────────────

/**
 * Save session state to sessionStorage
 */
export function saveSession(
  conversationHistory: any[],
  currentChatId: string | null,
  activeComponent: ComponentType | null,
  componentProps: ComponentProps,
  paneWidths: PaneWidths
): boolean {
  try {
    const json = serializeSession(
      conversationHistory,
      currentChatId,
      activeComponent,
      componentProps,
      paneWidths
    );
    sessionStorage.setItem(SESSION_STORAGE_KEY, json);
    return true;
  } catch (error) {
    console.error('[Session] Failed to save:', error);
    return false;
  }
}

/**
 * Load session state from sessionStorage
 * Returns null if no session exists or if it's corrupted
 */
export function loadSession(): Partial<SessionState> | null {
  try {
    const json = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!json) {
      return null;
    }
    return deserializeSession(json);
  } catch (error) {
    console.error('[Session] Failed to load:', error);
    return null;
  }
}

/**
 * Clear session from sessionStorage
 */
export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('[Session] Failed to clear:', error);
  }
}

/**
 * Clear session on logout
 * Also clears component cache and resets store to default state
 */
export function clearSessionOnLogout(): void {
  clearSession();
  
  // Clear localStorage pane widths (optional - could keep for next login)
  // localStorage.removeItem('matsyaai_pane_widths');
  
  console.log('[Session] Cleared session on logout');
}

/**
 * Check if sessionStorage is available
 */
export function isSessionStorageAvailable(): boolean {
  try {
    const test = '__session_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}
