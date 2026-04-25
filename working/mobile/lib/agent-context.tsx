/**
 * AgentContext - Global context that silently tracks user actions across all screens.
 *
 * Every screen updates this context as the user navigates. The "Ask Agent" button
 * on any screen sends the accumulated context alongside the user's question.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

export interface AgentContextState {
  currentScreen:
    | "chat"
    | "home"
    | "map"
    | "history"
    | "upload"
    | "analytics"
    | "settings";
  currentLocation?: { lat: number; lon: number };
  selectedCatch?: {
    imageId: string;
    species: string;
    weight?: number;
    quality?: string;
    groupId?: string;
  };
  selectedGroup?: {
    groupId: string;
    fishCount: number;
    species?: string;
    totalWeight?: number;
    totalValue?: number;
  };
  mapViewport?: { lat: number; lon: number; zoom: number };
  mapSelectedLocation?: { lat: number; lon: number; name?: string };
  recentAction?: string;
  filterState?: { species?: string; dateRange?: string };
  analyticsMetric?: string;
  scanResults?: {
    groupId: string;
    fishCount: number;
    species: Record<string, number>;
    totalWeight: number;
    totalValue: number;
    diseaseDetected: boolean;
  };
  settings: { language: string; units: string; port?: string };
  connectionQuality: string;
  timestamp: string;
}

/**
 * Build a compact context string using bracket-tag format.
 * These tags are prepended to every message sent to the agent.
 * They are stripped from display in the chat UI.
 */
function buildContextPrompt(state: AgentContextState): string {
  const parts: string[] = [];

  parts.push(`[page:${state.currentScreen ?? "chat"}]`);
  if (state.settings.language !== "en")
    parts.push(`[lang:${state.settings.language}]`);
  if (state.currentLocation) {
    parts.push(
      `[userLoc:${state.currentLocation.lat.toFixed(4)},${state.currentLocation.lon.toFixed(4)}]`,
    );
  }
  if (state.selectedGroup) {
    parts.push(`[groupId:${state.selectedGroup.groupId}]`);
    if (state.selectedGroup.species)
      parts.push(`[species:${state.selectedGroup.species}]`);
  }
  if (state.selectedCatch) {
    if (state.selectedCatch.groupId)
      parts.push(`[groupId:${state.selectedCatch.groupId}]`);
    if (state.selectedCatch.species)
      parts.push(`[species:${state.selectedCatch.species}]`);
  }
  if (state.mapSelectedLocation) {
    parts.push(
      `[mapPin:${state.mapSelectedLocation.lat.toFixed(4)},${state.mapSelectedLocation.lon.toFixed(4)}]`,
    );
  }
  if (state.mapViewport) {
    parts.push(`[mapZoom:${state.mapViewport.zoom}]`);
  }
  if (state.scanResults) {
    const s = state.scanResults;
    parts.push(
      `[scan:${s.fishCount} fish, ${s.totalWeight}kg, ₹${s.totalValue}${s.diseaseDetected ? ", disease" : ""}]`,
    );
  }
  if (state.connectionQuality === "offline") parts.push("[offline]");

  return parts.join(" ");
}

interface AgentContextValue {
  state: AgentContextState;
  updateScreen: (screen: AgentContextState["currentScreen"]) => void;
  updateLocation: (lat: number, lon: number) => void;
  selectCatch: (data: AgentContextState["selectedCatch"]) => void;
  selectGroup: (data: AgentContextState["selectedGroup"]) => void;
  setMapLocation: (data: AgentContextState["mapSelectedLocation"]) => void;
  setMapViewport: (data: AgentContextState["mapViewport"]) => void;
  setScanResults: (data: AgentContextState["scanResults"]) => void;
  setRecentAction: (action: string) => void;
  setAnalyticsMetric: (metric: string) => void;
  updateSettings: (s: Partial<AgentContextState["settings"]>) => void;
  setConnectionQuality: (q: string) => void;
  getContextPrompt: () => string;
  clearSelection: () => void;
}

const defaultState: AgentContextState = {
  currentScreen: "home",
  settings: { language: "en", units: "metric" },
  connectionQuality: "unknown",
  timestamp: new Date().toISOString(),
};

const AgentCtx = createContext<AgentContextValue | null>(null);

export function AgentContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AgentContextState>(defaultState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((partial: Partial<AgentContextState>) => {
    setState((prev) => ({
      ...prev,
      ...partial,
      timestamp: new Date().toISOString(),
    }));
  }, []);

  const updateScreen = useCallback(
    (screen: AgentContextState["currentScreen"]) => {
      patch({ currentScreen: screen });
    },
    [patch],
  );

  const updateLocation = useCallback(
    (lat: number, lon: number) => {
      patch({ currentLocation: { lat, lon } });
    },
    [patch],
  );

  const selectCatch = useCallback(
    (data: AgentContextState["selectedCatch"]) => {
      patch({ selectedCatch: data, selectedGroup: undefined });
    },
    [patch],
  );

  const selectGroup = useCallback(
    (data: AgentContextState["selectedGroup"]) => {
      patch({ selectedGroup: data, selectedCatch: undefined });
    },
    [patch],
  );

  const setMapLocation = useCallback(
    (data: AgentContextState["mapSelectedLocation"]) => {
      patch({ mapSelectedLocation: data });
    },
    [patch],
  );

  const setMapViewport = useCallback(
    (data: AgentContextState["mapViewport"]) => {
      patch({ mapViewport: data });
    },
    [patch],
  );

  const setScanResults = useCallback(
    (data: AgentContextState["scanResults"]) => {
      patch({ scanResults: data });
    },
    [patch],
  );

  const setRecentAction = useCallback(
    (action: string) => {
      patch({ recentAction: action });
    },
    [patch],
  );

  const setAnalyticsMetric = useCallback(
    (metric: string) => {
      patch({ analyticsMetric: metric });
    },
    [patch],
  );

  const updateSettings = useCallback(
    (s: Partial<AgentContextState["settings"]>) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...s },
        timestamp: new Date().toISOString(),
      }));
    },
    [],
  );

  const setConnectionQuality = useCallback(
    (q: string) => {
      patch({ connectionQuality: q });
    },
    [patch],
  );

  const getContextPrompt = useCallback(() => {
    return buildContextPrompt(stateRef.current);
  }, []);

  const clearSelection = useCallback(() => {
    patch({
      selectedCatch: undefined,
      selectedGroup: undefined,
      mapSelectedLocation: undefined,
      scanResults: undefined,
      recentAction: undefined,
      analyticsMetric: undefined,
    });
  }, [patch]);

  return (
    <AgentCtx.Provider
      value={{
        state,
        updateScreen,
        updateLocation,
        selectCatch,
        selectGroup,
        setMapLocation,
        setMapViewport,
        setScanResults,
        setRecentAction,
        setAnalyticsMetric,
        updateSettings,
        setConnectionQuality,
        getContextPrompt,
        clearSelection,
      }}
    >
      {children}
    </AgentCtx.Provider>
  );
}

export function useAgentContext() {
  const ctx = useContext(AgentCtx);
  if (!ctx)
    throw new Error("useAgentContext must be used within AgentContextProvider");
  return ctx;
}
