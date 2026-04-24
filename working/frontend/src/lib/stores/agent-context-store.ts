/**
 * Global Agent Context Store
 *
 * Tracks what the user is currently doing so every prompt to the agent
 * can silently include rich context (current page, selected catch,
 * map position, scan results, etc.).
 */

import { create } from 'zustand';
import type { ComponentType } from '@/types/agent-first';

export interface AgentContextState {
  // ── Tracked automatically ────────────────────────────────────────────────
  currentPage: ComponentType | 'chat';
  currentGroupId: string | null;
  currentImageIndex: number;
  currentSpecies: string | null;
  scanSummary: string | null;          // populated after a scan completes
  mapCenter: { lat: number; lon: number } | null;
  mapZoom: number | null;
  selectedMapPoint: { lat: number; lon: number } | null;
  userLocation: { lat: number; lon: number } | null;

  // ── Settings / env ───────────────────────────────────────────────────────
  locale: string;
  isOffline: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  setCurrentPage: (page: ComponentType | 'chat') => void;
  setSelectedMapPoint: (point: { lat: number; lon: number } | null) => void;
  setMapView: (center: { lat: number; lon: number }, zoom: number) => void;
  setCurrentGroup: (groupId: string | null, imageIndex?: number, species?: string) => void;
  setScanSummary: (summary: string | null) => void;
  setUserLocation: (loc: { lat: number; lon: number } | null) => void;
  setLocale: (locale: string) => void;
  setOffline: (offline: boolean) => void;

  /** Builds a compact context string to prepend to agent prompts */
  buildContextPayload: () => string;
  /** Returns the human-readable label shown in the ContextPill */
  getContextLabel: () => string;
  /** Resets global context when panes close */
  resetContext: () => void;
  /** Clears only the context fields owned by a specific panel */
  clearPanelContext: (panel: ComponentType | 'chat') => void;
}

export const useAgentContext = create<AgentContextState>((set, get) => ({
  currentPage: 'chat',
  currentGroupId: null,
  currentImageIndex: 0,
  currentSpecies: null,
  scanSummary: null,
  mapCenter: null,
  mapZoom: null,
  selectedMapPoint: null,
  userLocation: null,
  locale: 'en',
  isOffline: false,

  setCurrentPage: (page) => set({ currentPage: page }),
  setSelectedMapPoint: (point) => set({ selectedMapPoint: point }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),
  setCurrentGroup: (groupId, imageIndex = 0, species = undefined) =>
    set({ currentGroupId: groupId, currentImageIndex: imageIndex, currentSpecies: species }),
  setScanSummary: (summary) => set({ scanSummary: summary }),
  setUserLocation: (loc) => set({ userLocation: loc }),
  setLocale: (locale) => set({ locale }),
  setOffline: (offline) => set({ isOffline: offline }),

  resetContext: () => set({
    currentPage: 'chat',
    currentGroupId: null,
    currentImageIndex: 0,
    currentSpecies: null,
    scanSummary: null,
    mapCenter: null,
    mapZoom: null,
    selectedMapPoint: null,
  }),

  clearPanelContext: (panel) => {
    // Each panel owns a specific subset of context fields.
    // Only clear what belongs to the panel being LEFT.
    if (panel === 'upload') {
      set({ scanSummary: null });
    } else if (panel === 'history') {
      set({ currentGroupId: null, currentImageIndex: 0, currentSpecies: null });
    } else if (panel === 'map') {
      set({ selectedMapPoint: null });
    } else if (panel === 'analytics') {
      // analytics has no owned context fields currently
    }
  },

  getContextLabel: () => {
    const s = get();
    if (s.currentPage === 'map' && s.selectedMapPoint && s.selectedMapPoint.lat != null && s.selectedMapPoint.lon != null) {
      return `Map · ${s.selectedMapPoint.lat.toFixed(2)}°N, ${s.selectedMapPoint.lon.toFixed(2)}°E`;
    }
    if (s.currentPage === 'map') return 'Viewing Map';
    if (s.currentPage === 'history' && s.currentGroupId) return `Catch #${s.currentGroupId.slice(0, 8)}`;
    if (s.currentPage === 'history') return 'Viewing History';
    if (s.currentPage === 'upload' && s.currentSpecies) return `Upload · ${s.currentSpecies}`;
    if (s.currentPage === 'upload') return 'Upload / Scan';
    if (s.currentPage === 'analytics') return 'Analytics';
    return 'Chat';
  },

  buildContextPayload: () => {
    const s = get();
    const parts: string[] = [];
    parts.push(`[page:${s.currentPage ?? 'chat'}]`);
    if (s.locale !== 'en') parts.push(`[lang:${s.locale}]`);
    if (s.userLocation) parts.push(`[userLoc:${s.userLocation.lat.toFixed(4)},${s.userLocation.lon.toFixed(4)}]`);
    if (s.currentGroupId) parts.push(`[groupId:${s.currentGroupId}]`);
    if (s.currentSpecies) parts.push(`[species:${s.currentSpecies}]`);
    if (s.currentImageIndex > 0) parts.push(`[imgIdx:${s.currentImageIndex}]`);
    if (s.selectedMapPoint && s.selectedMapPoint.lat != null && s.selectedMapPoint.lon != null) parts.push(`[mapPin:${s.selectedMapPoint.lat.toFixed(4)},${s.selectedMapPoint.lon.toFixed(4)}]`);
    if (s.scanSummary) parts.push(`[scan:${s.scanSummary}]`);
    if (s.isOffline) parts.push('[offline]');
    return parts.join(' ');
  },
}));
