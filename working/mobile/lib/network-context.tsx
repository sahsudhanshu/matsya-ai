/**
 * Network connectivity context for automatic online/offline mode switching
 * Includes connection quality detection and sync status tracking
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { SyncService, SyncStatusType } from "./sync-service";

interface NetworkContextType {
  isOnline: boolean;
  isChecking: boolean;
  connectionQuality: "excellent" | "good" | "poor" | "offline";
  effectiveMode: "online" | "offline"; // Actual mode considering speed
  syncStatus: SyncStatusType;
  pendingCount: number;
  failedCount: number;
  lastSyncTime: Date | null;
  manualSync: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isChecking: true,
  connectionQuality: "good",
  effectiveMode: "online",
  syncStatus: "idle",
  pendingCount: 0,
  failedCount: 0,
  lastSyncTime: null,
  manualSync: async () => {},
});

// Connection quality thresholds
const QUALITY_THRESHOLDS = {
  // Effective download speed in Kbps
  EXCELLENT: 5000, // 5 Mbps+
  GOOD: 1000, // 1 Mbps+
  POOR: 500, // 500 Kbps+
};

// Timeout for slow connections (ms)
const SLOW_CONNECTION_TIMEOUT = 8000; // 8 seconds

function assessConnectionQuality(
  state: NetInfoState,
): "excellent" | "good" | "poor" | "offline" {
  if (!state.isConnected) return "offline";

  // Check connection type
  const type = state.type;

  // WiFi is generally fast
  if (type === "wifi") {
    return "excellent";
  }

  // Cellular - check details if available
  if (type === "cellular" && state.details) {
    const details = state.details as any;

    // Check cellular generation
    if (details.cellularGeneration) {
      const gen = details.cellularGeneration;
      if (gen === "5g") return "excellent";
      if (gen === "4g") return "good";
      if (gen === "3g") return "poor";
      if (gen === "2g") return "poor";
    }

    // Check effective connection type (if available)
    if (details.effectiveConnectionType) {
      const effectiveType = details.effectiveConnectionType;
      if (effectiveType === "4g") return "good";
      if (effectiveType === "3g") return "poor";
      if (effectiveType === "2g") return "poor";
    }
  }

  // Default to good for unknown cellular
  if (type === "cellular") return "good";

  // Other connection types (ethernet, etc.)
  return "good";
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<
    "excellent" | "good" | "poor" | "offline"
  >("good");
  const [effectiveMode, setEffectiveMode] = useState<"online" | "offline">(
    "online",
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // Initialize sync service
    SyncService.initialize();

    // Subscribe to sync status changes
    const unsubscribeSync = SyncService.subscribe((status) => {
      setSyncStatus(status.syncStatus);
      setPendingCount(status.pending);
      setFailedCount(status.failed);
      if (status.lastSync) {
        setLastSyncTime(new Date(status.lastSync));
      }
    });

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      const quality = assessConnectionQuality(state);

      setIsOnline(connected);
      setConnectionQuality(quality);

      // Use offline mode if connection is poor or offline
      // This ensures better UX on slow connections
      if (!connected || quality === "poor") {
        setEffectiveMode("offline");
      } else {
        setEffectiveMode("online");
      }

      setIsChecking(false);

      // Notify network monitor
      import("./network-monitor").then(({ networkMonitor }) => {
        networkMonitor.onNetworkChange(
          connected && quality !== "poor",
          quality,
        );
      });
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      const connected = state.isConnected ?? false;
      const quality = assessConnectionQuality(state);

      setIsOnline(connected);
      setConnectionQuality(quality);

      if (!connected || quality === "poor") {
        setEffectiveMode("offline");
      } else {
        setEffectiveMode("online");
      }

      setIsChecking(false);
    });

    // Initial sync status
    SyncService.getSyncStatus().then((status) => {
      setSyncStatus(status.syncStatus);
      setPendingCount(status.pending);
      setFailedCount(status.failed);
      if (status.lastSync) {
        setLastSyncTime(new Date(status.lastSync));
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSync();
      SyncService.cleanup();
    };
  }, []);

  const manualSync = async () => {
    await SyncService.manualSync();
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isChecking,
        connectionQuality,
        effectiveMode,
        syncStatus,
        pendingCount,
        failedCount,
        lastSyncTime,
        manualSync,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}

/**
 * Test connection speed by attempting a quick API call with timeout
 * Returns true if connection is fast enough for online mode
 */
export async function testConnectionSpeed(apiUrl: string): Promise<boolean> {
  if (!apiUrl) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      SLOW_CONNECTION_TIMEOUT,
    );

    const startTime = Date.now();
    const response = await fetch(`${apiUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    const endTime = Date.now();

    clearTimeout(timeoutId);

    // If health check took more than 3 seconds, consider it slow
    const responseTime = endTime - startTime;
    return response.ok && responseTime < 3000;
  } catch (error) {
    // Timeout or network error - use offline mode
    return false;
  }
}
