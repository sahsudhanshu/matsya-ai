/**
 * Ocean Map - professional redesign v3.
 *
 * Changes:
 *   - Deep Scan: glassmorphic half-map overlay (no Modal).
 *   - Alerts: glassmorphic panel overlay on map.
 *   - Tap-on-map: floating info card at the tapped location + Send to AI.
 *   - Professional Ionicons everywhere, zero emoji in UI elements.
 *   - Fix: weight_g=0 was rendering as bare text node (crash).
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  AppState,
  AppStateStatus,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, {
  Marker,
  Circle as MapCircle,
  UrlTile,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import Ionicons from "@expo/vector-icons/Ionicons";

import { getMapData } from "../../lib/api-client";
import type { MapMarker, FishingSpot } from "../../lib/api-client";
import {
  fishingSpotsStream,
  type ScanProgress,
  type ScanResult,
} from "../../lib/fishing-spots-stream-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { useNetwork } from "../../lib/network-context";
import { ProfileMenu } from "../../components/ui/ProfileMenu";
import { OfflineFeatureMessage } from "../../components/ui/OfflineFeatureMessage";
import {
  fetchLiveAlerts,
  computeSafetyStatus,
  getSeverityColor,
  getAlertIcon,
} from "../../lib/alerts";
import type { DisasterAlert } from "../../lib/alerts";
import { requestNotificationPermissions } from "../../lib/notification-service";

const OWM_KEY = process.env.EXPO_PUBLIC_OWM_API_KEY || "";
const { width: SCREEN_W } = Dimensions.get("window");

// ── Constants ────────────────────────────────────────────────────────────────
const SATELLITE_TILE = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";
const OWM_LAYER_IDS: Record<string, string> = {
  temp: "temp_new",
  wind: "wind_new",
  pressure: "pressure_new",
};

type LayerId = "temp" | "wind" | "pressure";
const LAYERS: { id: LayerId; label: string; icon: string; desc: string }[] = [
  {
    id: "temp",
    label: "Temperature",
    icon: "thermometer-outline",
    desc: "°C surface",
  },
  { id: "wind", label: "Wind Speed", icon: "flag-outline", desc: "m/s" },
  {
    id: "pressure",
    label: "Pressure",
    icon: "radio-button-off-outline",
    desc: "hPa",
  },
];

type ScaleStop = { color: string; value: string };
const WEATHER_SCALES: Record<
  LayerId,
  { label: string; unit: string; stops: ScaleStop[] }
> = {
  temp: {
    label: "Temperature",
    unit: "°C",
    stops: [
      { color: "#821692", value: "-40" },
      { color: "#0000ff", value: "-20" },
      { color: "#00d4ff", value: "0" },
      { color: "#00ff00", value: "10" },
      { color: "#ffff00", value: "20" },
      { color: "#ff8c00", value: "30" },
      { color: "#ff0000", value: "40" },
    ],
  },
  wind: {
    label: "Wind Speed",
    unit: "m/s",
    stops: [
      { color: "#ffffff", value: "0" },
      { color: "#aef1f9", value: "5" },
      { color: "#4dc9f6", value: "10" },
      { color: "#1a9edb", value: "15" },
      { color: "#ff8c00", value: "25" },
      { color: "#ff0000", value: "35" },
    ],
  },
  pressure: {
    label: "Pressure",
    unit: "hPa",
    stops: [
      { color: "#0000ff", value: "950" },
      { color: "#00bfff", value: "980" },
      { color: "#00ff00", value: "1000" },
      { color: "#ffff00", value: "1013" },
      { color: "#ff8c00", value: "1030" },
      { color: "#ff0000", value: "1050" },
    ],
  },
};

const GRADE_COLOR: Record<string, string> = {
  Premium: COLORS.secondaryLight,
  Standard: COLORS.accentLight,
  Low: "#ef4444",
};

// ── Deep-scan stage copy ──────────────────────────────────────────────────────
const SCAN_STAGE_LABELS: Record<string, string> = {
  init: "Initialising",
  osm: "Mapping Water Bodies",
  history: "Loading Catch History",
  scan: "Deep Scanning",
  finalise: "Finalising",
  done: "Complete",
};

const SCAN_STAGE_ICONS: Record<string, string> = {
  init: "radio-outline",
  osm: "globe-outline",
  history: "server-outline",
  scan: "scan-outline",
  finalise: "analytics-outline",
  done: "checkmark-circle-outline",
};

// ─────────────────────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { t } = useLanguage();
  const { isOnline } = useNetwork();

  // ── Catch markers ────────────────────────────────────────────────────────
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loadingMarkers, setLoadingMarkers] = useState(true);

  // ── Weather layer ─────────────────────────────────────────────────────────
  const [activeLayer, setActiveLayer] = useState<LayerId | null>(null);
  const [layersPopupVisible, setLayersPopupVisible] = useState(false);

  // ── Alerts ────────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [alertsVisible, setAlertsVisible] = useState(false);

  // ── Location + sun ────────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [sunTimes, setSunTimes] = useState<{
    sunrise: string;
    sunset: string;
  } | null>(null);

  // ── Tap-on-map floating card ──────────────────────────────────────────────
  const [tapCard, setTapCard] = useState<{
    lat: number;
    lng: number;
    temp?: number;
    wind?: number;
    humidity?: number;
    description?: string;
    loading: boolean;
    cardX?: number;
    cardY?: number;
  } | null>(null);

  // ── Fishing spots (scan results) ──────────────────────────────────────────
  const [fishingSpots, setFishingSpots] = useState<FishingSpot[]>([]);
  const [spotsVisible, setSpotsVisible] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<FishingSpot | null>(null);

  // ── Deep-scan overlay state ───────────────────────────────────────────────
  type ScanState = "idle" | "scanning" | "done" | "error" | "cancelled";
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanMessages, setScanMessages] = useState<string[]>([]);
  const [scanSummary, setScanSummary] = useState("");
  const [scanError, setScanError] = useState("");

  // Pulse animation for the deep scan FAB when scan is running
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Catch marker selection ────────────────────────────────────────────────
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  const mapRef = useRef<MapView>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const scanMessages_ref = useRef<string[]>([]);

  const safetyStatus = useMemo(() => {
    if (!userLocation || !alerts.length) return null;
    return computeSafetyStatus(userLocation.lat, userLocation.lng, alerts);
  }, [userLocation, alerts]);

  // ── Notification setup ────────────────────────────────────────────────────
  useEffect(() => {
    requestNotificationPermissions().catch(console.error);
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  // ── AppState tracking (to know if user left the page) ─────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appState.current = state;
    });
    return () => sub.remove();
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      setLocationPermission(true);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      mapRef.current?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 1.5,
          longitudeDelta: 1.5,
        },
        800,
      );
    })();
  }, []);

  // ── Sunrise / Sunset ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!OWM_KEY || !userLocation) return;
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${userLocation.lat}&lon=${userLocation.lng}&appid=${OWM_KEY}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.sys?.sunrise && d.sys?.sunset) {
          const fmt = (ts: number) =>
            new Date(ts * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
          setSunTimes({
            sunrise: fmt(d.sys.sunrise),
            sunset: fmt(d.sys.sunset),
          });
        }
      })
      .catch(console.error);
  }, [userLocation]);

  // ── Load catch markers ────────────────────────────────────────────────────
  const loadMarkers = useCallback(async () => {
    setLoadingMarkers(true);
    try {
      const data = await getMapData();
      setMarkers(data.markers || []);
    } catch (e) {
      console.error("Map data error:", e);
    } finally {
      setLoadingMarkers(false);
    }
  }, []);

  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  // ── Live Alerts ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!OWM_KEY || !isOnline) return;
    const poll = () =>
      fetchLiveAlerts(OWM_KEY).then(setAlerts).catch(console.error);
    poll();
    const id = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline]);

  // ── Deep Scan FAB pulse animation ─────────────────────────────────────────
  useEffect(() => {
    if (scanState === "scanning") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [scanState]);

  // ── Deep Scan – start ─────────────────────────────────────────────────────
  const startDeepScan = useCallback(() => {
    if (!userLocation) return;

    // If results already exist, just show them
    if (fishingSpots.length > 0 && scanState === "idle") {
      setScanState("done");
      setSpotsVisible(true);
      return;
    }

    setScanState("scanning");
    setScanProgress(null);
    setScanMessages([]);
    setScanSummary("");
    setScanError("");
    scanMessages_ref.current = [];

    fishingSpotsStream.stream({
      lat: userLocation.lat,
      lon: userLocation.lng,
      radiusKm: 50,

      onProgress: (prog) => {
        setScanProgress(prog);
        setScanMessages((prev) => {
          const next = [...prev, prog.message];
          scanMessages_ref.current = next;
          // Keep only last 30 messages to avoid runaway list
          return next.slice(-30);
        });
      },

      onResult: (result: ScanResult) => {
        setFishingSpots(result.spots);
        setSpotsVisible(true);
        setScanState("done");
        setScanSummary(result.summary);

        // Center map on the mean of all spot locations
        if (result.spots.length > 0 && mapRef.current) {
          const coords = result.spots.map((s) => ({
            latitude: s.latitude,
            longitude: s.longitude,
          }));
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 80, right: 60, bottom: 200, left: 60 },
            animated: true,
          });
        }

        // Notify if user left the page
        if (appState.current !== "active") {
          const count = result.spots.length;
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Deep Scan Complete",
              body: `Found ${count} fishing spot${count !== 1 ? "s" : ""} near you.`,
              data: { screen: "map" },
              sound: "default",
            },
            trigger: null,
          }).catch(console.error);
        }
      },

      onError: (msg) => {
        setScanState("error");
        if (msg.includes("No water bodies found")) {
          setScanError(
            "Deep Scan was unable to find any significant water bodies or fishing spots in this area. Try moving the map to a coastal region or increasing your search radius.",
          );
        } else {
          setScanError(msg);
        }
      },

      onCancelled: () => {
        setScanState("cancelled");
      },
    });
  }, [userLocation]);

  // ── Deep Scan – cancel ────────────────────────────────────────────────────
  const cancelDeepScan = useCallback(() => {
    fishingSpotsStream.cancel();
    setScanState("cancelled");
  }, []);

  // ── Deep Scan – dismiss overlay ──────────────────────────────────────────
  const dismissScan = useCallback(() => {
    if (scanState === "scanning") {
      cancelDeepScan();
    }
    setScanState("idle");
  }, [scanState, cancelDeepScan]);

  // ── Tap-anywhere: weather + floating card ────────────────────────────────
  const handleMapPress = useCallback(
    async (e: any) => {
      if (layersPopupVisible) {
        setLayersPopupVisible(false);
        return;
      }
      if (!OWM_KEY) return;

      const { latitude: lat, longitude: lng } = e.nativeEvent?.coordinate || {};
      if (lat === undefined || lng === undefined) return;

      setSelectedMarker(null);
      setSelectedSpot(null);

      // Calculate screen position for the floating card
      let cardX: number | undefined;
      let cardY: number | undefined;
      if (mapRef.current) {
        try {
          const pt = await mapRef.current.pointForCoordinate({
            latitude: lat,
            longitude: lng,
          });
          cardX = Math.max(8, Math.min(pt.x - 110, SCREEN_W - 228));
          cardY = Math.max(8, pt.y - 195);
        } catch {
          // fall back to top-left
        }
      }

      setTapCard({ lat, lng, loading: true, cardX, cardY });
      try {
        const r = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric`,
        );
        const d = await r.json();
        setTapCard({
          lat,
          lng,
          loading: false,
          cardX,
          cardY,
          temp: d.main?.temp,
          wind: d.wind?.speed,
          humidity: d.main?.humidity,
          description: d.weather?.[0]?.description,
        });
      } catch {
        setTapCard(null);
      }
    },
    [layersPopupVisible],
  );

  // ── Recenter ──────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 1.5,
        longitudeDelta: 1.5,
      },
      800,
    );
  }, [userLocation]);

  // ── Send tapped location to AI chat ──────────────────────────────────────
  const sendLocationToAI = useCallback(() => {
    if (!tapCard) return;
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        markerType: "ocean location",
        markerCoordinates: `${tapCard.lat.toFixed(5)}, ${tapCard.lng.toFixed(5)}`,
      },
    });
  }, [tapCard]);

  const validMarkers = useMemo(
    () =>
      markers.filter(
        (m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude),
      ),
    [markers],
  );

  const owmTileUrl = useMemo(() => {
    if (!activeLayer || !OWM_KEY) return null;
    return `https://tile.openweathermap.org/map/${OWM_LAYER_IDS[activeLayer]}/{z}/{x}/{y}.png?appid=${OWM_KEY}`;
  }, [activeLayer]);

  const currentScale = activeLayer ? WEATHER_SCALES[activeLayer] : null;

  const scanOverlayVisible = scanState !== "idle";

  // ── Offline guard ─────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <View className="flex-row items-center px-4 py-3 gap-3 border-b border-border bg-bgDark">
          <Text className="text-lg font-bold text-textPrimary">
            {t("nav.oceanMap")}
          </Text>
          <ProfileMenu size={34} />
        </View>
        <OfflineFeatureMessage featureName="Ocean Map" />
      </SafeAreaView>
    );
  }

  const scanFabLabel =
    scanState === "scanning"
      ? "Scanning…"
      : scanState === "done"
        ? "Spots Found"
        : "Deep Scan";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View className="flex-row items-center px-4 py-3 gap-3 border-b border-border bg-bgDark">
        <View className="flex-1">
          <Text className="text-lg font-bold text-textPrimary">
            {t("nav.oceanMap")}
          </Text>
          <Text className="text-xs text-textMuted mt-0.5">
            {validMarkers.length} catches
            {alerts.length > 0 ? `  ·  ${alerts.length} alerts` : ""}
          </Text>
        </View>

        <TouchableOpacity
          className="w-[34px] h-[34px] rounded-lg border border-border bg-bgCard items-center justify-center"
          onPress={loadMarkers}
          disabled={loadingMarkers}
          activeOpacity={0.7}
        >
          {loadingMarkers ? (
            <ActivityIndicator size="small" color={COLORS.primaryLight} />
          ) : (
            <Ionicons name="refresh" size={18} color={COLORS.textSecondary} />
          )}
        </TouchableOpacity>

        {/* Alerts chip */}
        <TouchableOpacity
          className={`flex-row items-center gap-1 rounded-lg border border-border bg-bgCard px-4 py-1.5 ${alertsVisible ? "border-[#f8717155] bg-[#f8717114]" : ""}`}
          onPress={() => setAlertsVisible((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="warning-outline"
            size={12}
            color={alertsVisible ? "#f87171" : COLORS.textSecondary}
          />
          <Text
            className="text-xs font-semibold text-textSecondary"
            style={alertsVisible ? { color: "#f87171" } : undefined}
          >
            Alerts{alerts.length > 0 ? ` (${alerts.length})` : ""}
          </Text>
        </TouchableOpacity>

        <ProfileMenu size={34} />
      </View>

      {/* ── SUNRISE / SUNSET STRIP ────────────────────────────────────── */}
      {sunTimes && (
        <View className="flex-row items-center gap-[5px] px-4 py-[6px] bg-bgCard border-b border-border">
          <Ionicons name="sunny-outline" size={13} color={COLORS.accentLight} />
          <Text className="text-xs text-textSecondary">
            Rise {sunTimes.sunrise}
          </Text>
          <View className="w-[1px] h-3 bg-border mx-1" />
          <Ionicons name="moon-outline" size={13} color={COLORS.accentLight} />
          <Text className="text-xs text-textSecondary">
            Set {sunTimes.sunset}
          </Text>
          {safetyStatus && (
            <>
              <View className="w-[1px] h-3 bg-border mx-1" />
              <View
                className={`px-2 py-[2px] rounded-full ${safetyStatus === "SAFE" ? "bg-secondaryLight/20" : "bg-[#f8717120]"}`}
              >
                <Text
                  className="text-xs font-bold tracking-[0.3px]"
                  style={{
                    color:
                      safetyStatus === "SAFE"
                        ? COLORS.secondaryLight
                        : "#f87171",
                  }}
                >
                  {safetyStatus}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* ── ACTIVE LAYER LEGEND ───────────────────────────────────────── */}
      {activeLayer && currentScale && (
        <View className="mx-4 mb-2 bg-bgCard rounded-md border border-border p-3">
          <Text className="text-xs font-bold text-textMuted mb-1 uppercase tracking-wide">
            {currentScale.label} ({currentScale.unit})
          </Text>
          <View className="flex-row h-[10px] rounded-sm overflow-hidden">
            {currentScale.stops.map((s, i) => (
              <View
                key={i}
                className="flex-1"
                style={{ backgroundColor: s.color }}
              />
            ))}
          </View>
          <View className="flex-row justify-between mt-[3px]">
            {currentScale.stops.map((s, i) => (
              <Text key={i} className="text-[9px] text-textSubtle font-bold">
                {s.value}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* ── MAP ───────────────────────────────────────────────────────── */}
      <View className="flex-1 relative">
        <MapView
          ref={mapRef}
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: userLocation?.lat ?? 16.0,
            longitude: userLocation?.lng ?? 76.0,
            latitudeDelta: userLocation ? 6 : 18,
            longitudeDelta: userLocation ? 6 : 18,
          }}
          onPress={handleMapPress}
          showsUserLocation={locationPermission}
          showsMyLocationButton={false}
          mapType="hybrid"
        >
          {owmTileUrl && (
            <UrlTile
              urlTemplate={owmTileUrl}
              maximumZ={20}
              tileSize={256}
              opacity={0.5}
            />
          )}

          {validMarkers.map((m) => (
            <Marker
              key={m.imageId}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              onPress={() => {
                setSelectedMarker(m);
                setTapCard(null);
                setSelectedSpot(null);
              }}
              tracksViewChanges={false}
            >
              <View
                className="w-[28px] h-[28px] rounded-full items-center justify-center border-2 border-[rgba(255,255,255,0.2)]"
                style={{
                  backgroundColor:
                    GRADE_COLOR[m.qualityGrade ?? ""] ?? GRADE_COLOR.Low,
                }}
              >
                <Ionicons name="fish-outline" size={13} color="#fff" />
              </View>
            </Marker>
          ))}

          {spotsVisible &&
            fishingSpots.map((spot, i) => (
              <React.Fragment key={`spot-${i}`}>
                <MapCircle
                  center={{
                    latitude: spot.latitude,
                    longitude: spot.longitude,
                  }}
                  radius={600}
                  fillColor={spot.color + "88"}
                  strokeColor={spot.color}
                  strokeWidth={1.5}
                />
                <Marker
                  coordinate={{
                    latitude: spot.latitude,
                    longitude: spot.longitude,
                  }}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => {
                    setSelectedSpot(spot);
                    setTapCard(null);
                    setSelectedMarker(null);
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: spot.color,
                      borderWidth: 2,
                      borderColor: "#fff",
                      opacity: 0.85,
                    }}
                  />
                </Marker>
              </React.Fragment>
            ))}

          {/* Tap-on-map pin */}
          {tapCard && (
            <Marker
              coordinate={{ latitude: tapCard.lat, longitude: tapCard.lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              <Ionicons name="location" size={28} color={COLORS.primaryLight} />
            </Marker>
          )}
        </MapView>

        {/* ── Map FABs (right column) ──────────────────────────────────── */}
        <View className="absolute right-3 bottom-20 gap-2 items-center z-50">
          {/* Recenter */}
          <TouchableOpacity
            className="w-[42px] h-[42px] rounded-full bg-bgCard border border-border items-center justify-center shadow-md elevation-5"
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Layers */}
          <TouchableOpacity
            className={`w-[42px] h-[42px] rounded-full bg-bgCard border border-border items-center justify-center shadow-md elevation-5 ${activeLayer ? "border-[rgba(34,211,238,0.33)] bg-[rgba(34,211,238,0.09)]" : ""}`}
            onPress={() => setLayersPopupVisible((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="layers-outline"
              size={18}
              color={activeLayer ? COLORS.primaryLight : COLORS.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* ── Layers popup (Google-Maps style) ─────────────────────────── */}
        {layersPopupVisible && (
          <View className="absolute right-[62px] bottom-[80px] bg-bgCard rounded-xl border border-border p-3 w-[210px] z-50 shadow-lg elevation-10">
            <Text className="text-xs font-bold text-textMuted uppercase tracking-wide px-3 py-1 mb-0.5">
              Map Layer
            </Text>
            {LAYERS.map((layer) => (
              <TouchableOpacity
                key={layer.id}
                className={`flex-row items-center gap-3 p-3 rounded-md ${activeLayer === layer.id ? "bg-[rgba(34,211,238,0.07)]" : ""}`}
                onPress={() => {
                  setActiveLayer(activeLayer === layer.id ? null : layer.id);
                  setLayersPopupVisible(false);
                }}
                activeOpacity={0.8}
              >
                <View
                  className={`w-[34px] h-[34px] rounded-sm bg-bgSurface items-center justify-center ${activeLayer === layer.id ? "bg-[rgba(34,211,238,0.13)]" : ""}`}
                >
                  <Ionicons
                    name={layer.icon as any}
                    size={16}
                    color={
                      activeLayer === layer.id
                        ? COLORS.primaryLight
                        : COLORS.textMuted
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    className={`text-sm font-semibold text-textSecondary ${activeLayer === layer.id ? "text-primaryLight" : ""}`}
                  >
                    {layer.label}
                  </Text>
                  <Text className="text-xs text-textMuted mt-[1px]">
                    {layer.desc}
                  </Text>
                </View>
                {activeLayer === layer.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                )}
              </TouchableOpacity>
            ))}
            {activeLayer && (
              <TouchableOpacity
                className="mt-1 py-2 items-center border-t border-border"
                onPress={() => {
                  setActiveLayer(null);
                  setLayersPopupVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text className="text-xs text-[#f87171] font-semibold">
                  Clear layer
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── DEEP SCAN FAB (hidden while overlay is open) ──────────── */}
        {!scanOverlayVisible && (
          <View className="absolute left-4 bottom-5 z-50">
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                className="flex-row items-center gap-2 bg-[#1d4ed8] rounded-full py-[13px] px-5 shadow-lg elevation-8 shadow-[#1d4ed8]/55"
                onPress={startDeepScan}
                activeOpacity={0.85}
              >
                <Ionicons name="scan-outline" size={20} color="#fff" />
                <Text className="text-sm font-bold text-white tracking-[0.3px]">
                  {scanFabLabel}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Small loading spinner */}
        {loadingMarkers && (
          <View className="absolute top-3 self-center bg-bgCard/90 rounded-full p-2 border border-border z-10">
            <ActivityIndicator size="small" color={COLORS.primaryLight} />
          </View>
        )}

        {/* ── GLASSMORPHIC ALERTS OVERLAY ───────────────────────────── */}
        {alertsVisible && (
          <View className="absolute top-2 left-2 right-2 z-40 bg-[rgba(10,15,30,0.90)] rounded-xl border border-[rgba(255,255,255,0.10)] p-3 shadow-lg elevation-12">
            <View className="flex-row justify-between items-center mb-2">
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons name="warning-outline" size={14} color="#f87171" />
                <Text className="text-sm font-bold text-textPrimary">
                  Active Alerts
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAlertsVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            {alerts.length === 0 ? (
              <View className="flex-row items-center gap-2 py-1.5">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color={COLORS.secondaryLight}
                />
                <Text className="text-sm text-textMuted">
                  No active alerts in your area
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 160 }}
                showsVerticalScrollIndicator={false}
              >
                {alerts.map((a) => (
                  <View
                    key={a.id}
                    className="flex-row items-center py-1.5 border-b border-[rgba(255,255,255,0.06)]"
                  >
                    <Ionicons
                      name={getAlertIcon(a.type) as any}
                      size={13}
                      color={getSeverityColor(a.severity)}
                    />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: getSeverityColor(a.severity) }}
                        numberOfLines={1}
                      >
                        {a.title}
                      </Text>
                      <Text
                        className="text-xs text-textMuted mt-[1px]"
                        numberOfLines={1}
                      >
                        {a.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── HOVERING TAP LOCATION CARD ────────────────────────────── */}
        {tapCard && (
          <View
            className="absolute w-[220px] z-30 bg-[rgba(10,15,30,0.92)] rounded-xl border border-[rgba(255,255,255,0.12)] p-3 shadow-lg elevation-10"
            style={
              tapCard.cardX !== undefined && tapCard.cardY !== undefined
                ? { left: tapCard.cardX, top: tapCard.cardY }
                : { left: 12, top: 60 }
            }
          >
            {tapCard.loading ? (
              <View className="flex-row items-center gap-2 py-1">
                <ActivityIndicator size="small" color={COLORS.primaryLight} />
                <Text className="text-xs text-textMuted">
                  Fetching weather…
                </Text>
              </View>
            ) : (
              <>
                <View className="flex-row items-start justify-between mb-1.5">
                  <View style={{ flex: 1 }}>
                    <Text className="text-xs font-bold text-textPrimary tracking-[0.2px]">
                      {tapCard.lat.toFixed(4)}°N {tapCard.lng.toFixed(4)}°E
                    </Text>
                    {tapCard.description && (
                      <Text
                        className="text-[10px] text-textMuted mt-0.5 capitalize"
                        numberOfLines={1}
                      >
                        {tapCard.description}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setTapCard(null)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
                <View className="flex-row gap-3 mb-3 flex-wrap">
                  {tapCard.temp !== undefined && (
                    <View className="flex-row items-center gap-[3px]">
                      <Ionicons
                        name="thermometer-outline"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text className="text-xs text-textSecondary">
                        {tapCard.temp.toFixed(1)}°C
                      </Text>
                    </View>
                  )}
                  {tapCard.wind !== undefined && (
                    <View className="flex-row items-center gap-[3px]">
                      <Ionicons
                        name="flag-outline"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text className="text-xs text-textSecondary">
                        {tapCard.wind} m/s
                      </Text>
                    </View>
                  )}
                  {tapCard.humidity !== undefined && (
                    <View className="flex-row items-center gap-[3px]">
                      <Ionicons
                        name="water-outline"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text className="text-xs text-textSecondary">
                        {tapCard.humidity}%
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  className="flex-row items-center justify-center gap-[5px] bg-primaryLight rounded-full py-[7px] px-3.5"
                  onPress={sendLocationToAI}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={12}
                    color="#fff"
                  />
                  <Text className="text-xs font-semibold text-white">
                    Send to AI
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── GLASSMORPHIC DEEP SCAN OVERLAY ────────────────────────── */}
        {scanOverlayVisible && (
          <View className="absolute bottom-0 left-0 right-0 h-[52%] z-20 bg-[rgba(8,12,26,0.94)] rounded-t-[24px] border-t border-l border-r border-[rgba(255,255,255,0.10)] pt-3 px-4 pb-6 shadow-xl elevation-16">
            <View className="self-center w-[36px] h-1 rounded-full bg-[rgba(255,255,255,0.18)] mb-3" />

            <View className="flex-row items-start mb-3">
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                }}
              >
                <Ionicons
                  name={
                    (scanState === "done"
                      ? "checkmark-circle-outline"
                      : scanState === "error"
                        ? "alert-circle-outline"
                        : scanState === "cancelled"
                          ? "stop-circle-outline"
                          : (SCAN_STAGE_ICONS[scanProgress?.stage ?? "scan"] ??
                            "scan-outline")) as any
                  }
                  size={18}
                  color={
                    scanState === "done"
                      ? COLORS.secondaryLight
                      : scanState === "error"
                        ? "#f87171"
                        : COLORS.primaryLight
                  }
                />
                <View>
                  <Text className="text-lg font-bold text-textPrimary">
                    {scanState === "done"
                      ? "Scan Complete"
                      : scanState === "cancelled"
                        ? "Scan Cancelled"
                        : scanState === "error"
                          ? "Deep Scan Failed"
                          : "Deep Scan"}
                  </Text>
                  {scanState === "scanning" && scanProgress && (
                    <Text className="text-xs text-primaryLight mt-0.5 tracking-[0.3px]">
                      {SCAN_STAGE_LABELS[scanProgress.stage] ??
                        scanProgress.stage}
                    </Text>
                  )}
                </View>
              </View>
              {scanState === "scanning" ? (
                <TouchableOpacity
                  className="flex-row items-center gap-1 py-1.5 px-3 rounded-full border border-[#f8717155] bg-[#f8717112]"
                  onPress={cancelDeepScan}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={14} color="#f87171" />
                  <Text className="text-xs font-semibold text-[#f87171]">
                    Cancel
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={dismissScan}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Progress bar */}
            {scanState === "scanning" && scanProgress && (
              <View className="h-[3px] bg-[rgba(255,255,255,0.08)] rounded-sm overflow-hidden mb-3">
                <View
                  className="h-[3px] bg-primaryLight rounded-sm"
                  style={{ width: `${scanProgress.pct}%` as any }}
                />
              </View>
            )}

            {/* Done */}
            {scanState === "done" && (
              <View className="items-center py-4 gap-3">
                <Ionicons
                  name="checkmark-circle"
                  size={28}
                  color={COLORS.secondaryLight}
                />
                <Text className="text-sm text-textSecondary text-center leading-5 px-4">
                  {scanSummary}
                </Text>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 mt-2 py-2.5 px-6 rounded-full bg-primaryLight"
                  onPress={() => {
                    setSpotsVisible(true);
                    dismissScan();
                    // Center map on all spots
                    if (fishingSpots.length > 0 && mapRef.current) {
                      const coords = fishingSpots.map((s) => ({
                        latitude: s.latitude,
                        longitude: s.longitude,
                      }));
                      mapRef.current.fitToCoordinates(coords, {
                        edgePadding: {
                          top: 80,
                          right: 60,
                          bottom: 200,
                          left: 60,
                        },
                        animated: true,
                      });
                    }
                  }}
                >
                  <Ionicons name="map-outline" size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white">
                    View on Map
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error */}
            {scanState === "error" && (
              <View className="items-center py-4 gap-3">
                <Ionicons name="alert-circle" size={28} color="#f87171" />
                <Text
                  className="text-sm text-textSecondary text-center leading-5 px-4"
                  style={{ color: "#f87171" }}
                >
                  {scanError}
                </Text>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 mt-2 py-2.5 px-6 rounded-full bg-primaryLight"
                  onPress={() => {
                    dismissScan();
                    setTimeout(startDeepScan, 100);
                  }}
                >
                  <Ionicons name="refresh-outline" size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white">Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cancelled */}
            {scanState === "cancelled" && (
              <View className="items-center py-4 gap-3">
                <Ionicons
                  name="stop-circle-outline"
                  size={28}
                  color={COLORS.textMuted}
                />
                <Text className="text-sm text-textSecondary text-center leading-5 px-4">
                  Scan was cancelled.
                </Text>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 mt-2 py-2.5 px-6 rounded-full bg-primaryLight"
                  onPress={() => {
                    dismissScan();
                    setTimeout(startDeepScan, 100);
                  }}
                >
                  <Ionicons name="search-outline" size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white">
                    Start New Scan
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SSE live feed */}
            {scanState === "scanning" && (
              <ScrollView
                className="flex-1 mb-2"
                ref={(ref) => {
                  if (ref)
                    setTimeout(() => ref.scrollToEnd({ animated: true }), 50);
                }}
                showsVerticalScrollIndicator={false}
              >
                {scanMessages.map((msg, i) => (
                  <View
                    key={i}
                    className="flex-row items-start gap-2 py-[5px] border-b border-[rgba(255,255,255,0.05)]"
                  >
                    <View
                      className={`w-1.5 h-1.5 rounded-full bg-textSubtle mt-[5px] ${i === scanMessages.length - 1 ? "bg-primaryLight w-2 h-2 rounded-full" : ""}`}
                    />
                    <Text
                      className={`flex-1 text-xs text-textMuted leading-[17px] ${i === scanMessages.length - 1 ? "text-textPrimary font-semibold" : ""}`}
                    >
                      {msg}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {scanState === "scanning" && (
              <Text className="text-[10px] text-textSubtle text-center leading-[15px]">
                You can leave this page - you will be notified when the scan
                completes
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ── CATCH MARKER CARD (below map) ─────────────────────────────── */}
      {selectedMarker && (
        <View className="mx-4 mt-2 mb-3 bg-bgCard rounded-lg border border-border p-4 shadow-md elevation-4">
          <View className="flex-row justify-between items-start">
            <Text className="text-base font-bold text-textPrimary">
              {selectedMarker.species ?? "Unknown Species"}
            </Text>
            <TouchableOpacity onPress={() => setSelectedMarker(null)}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center gap-3 mt-3 flex-wrap">
            {(selectedMarker.weight_g ?? 0) > 0 && (
              <View className="flex-row items-center gap-1">
                <Ionicons
                  name="scale-outline"
                  size={13}
                  color={COLORS.textMuted}
                />
                <Text className="text-sm text-textSecondary">
                  {((selectedMarker.weight_g as number) / 1000).toFixed(2)} kg
                </Text>
              </View>
            )}
            {selectedMarker.qualityGrade && (
              <View
                className="px-2 py-[3px] rounded-full"
                style={{
                  backgroundColor:
                    (GRADE_COLOR[selectedMarker.qualityGrade] ??
                      GRADE_COLOR.Low) + "22",
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{
                    color:
                      GRADE_COLOR[selectedMarker.qualityGrade] ??
                      GRADE_COLOR.Low,
                  }}
                >
                  {selectedMarker.qualityGrade}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-textSubtle mt-1">
            {new Date(selectedMarker.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      )}

      {/* ── FISHING SPOT CARD (below map) ─────────────────────────────── */}
      {selectedSpot && (
        <View className="mx-4 mt-2 mb-3 bg-bgCard rounded-lg border border-border p-4 shadow-md elevation-4">
          <View className="flex-row justify-between items-start">
            <View style={{ flex: 1 }}>
              <Text className="text-base font-bold text-textPrimary">
                {selectedSpot.name}
              </Text>
              <Text className="text-xs text-textMuted mt-0.5 capitalize">
                {selectedSpot.type} · {selectedSpot.distance_km} km away
              </Text>
              {selectedSpot.parent_water_body ? (
                <Text
                  className="text-xs text-textMuted mt-0.5 capitalize"
                  style={{ marginTop: 2 }}
                >
                  {selectedSpot.parent_water_body}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setSelectedSpot(null)}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <View className="mt-3 mb-2">
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <Text className="text-xs text-textMuted uppercase tracking-wide">
                Confidence
              </Text>
              <Text
                className="text-lg font-bold"
                style={{ color: selectedSpot.color }}
              >
                {selectedSpot.confidence}
                <Text className="text-xs text-textMuted font-normal">
                  {" "}
                  / 100
                </Text>
              </Text>
            </View>
            <View className="h-1.5 rounded-[3px] bg-bgSurface mt-1 overflow-hidden">
              <View
                className="h-1.5 rounded-[3px]"
                style={{
                  width: `${selectedSpot.confidence}%` as any,
                  backgroundColor: selectedSpot.color,
                }}
              />
            </View>
          </View>
          <View className="flex-row items-center gap-3 mt-3 flex-wrap">
            <View className="flex-1 items-center p-3 rounded-sm bg-bgSurface gap-[3px]">
              <Ionicons
                name="fish-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text className="text-[10px] text-textMuted text-center">
                Fish Density
              </Text>
              <Text className="text-sm font-bold text-textPrimary">
                {selectedSpot.fish_density_score}/100
              </Text>
            </View>
            <View className="flex-1 items-center p-3 rounded-sm bg-bgSurface gap-[3px]">
              <Ionicons
                name="partly-sunny-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text className="text-[10px] text-textMuted text-center">
                Weather
              </Text>
              <Text className="text-sm font-bold text-textPrimary">
                {selectedSpot.weather_score}/100
              </Text>
            </View>
            <View className="flex-1 items-center p-3 rounded-sm bg-bgSurface gap-[3px]">
              <Ionicons
                name="navigate-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text className="text-[10px] text-textMuted text-center">
                Access
              </Text>
              <Text className="text-sm font-bold text-textPrimary">
                {selectedSpot.transport_score}/100
              </Text>
            </View>
          </View>
          {selectedSpot.gemini_web_score != null && (
            <View className="flex-row items-center gap-3 mt-3 flex-wrap">
              <View className="flex-1 items-center p-3 rounded-sm bg-bgSurface gap-[3px]">
                <Ionicons
                  name="globe-outline"
                  size={12}
                  color={COLORS.textMuted}
                />
                <Text className="text-[10px] text-textMuted text-center">
                  Web Score
                </Text>
                <Text className="text-sm font-bold text-textPrimary">
                  {selectedSpot.gemini_web_score}/100
                </Text>
              </View>
            </View>
          )}
          {selectedSpot.chlorophyll_available && (
            <View className="flex-row items-center gap-[5px] mt-1.5 mb-1.5">
              <Ionicons name="water-outline" size={12} color="#22d3ee" />
              <Text className="text-xs text-[#22d3ee]">
                Chlorophyll data included
              </Text>
            </View>
          )}
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 mt-3 bg-primary rounded-md py-2.5"
            onPress={() => {
              router.push({
                pathname: "/(tabs)/chat",
                params: {
                  zoneName: selectedSpot.name,
                  zoneCoordinates: `${selectedSpot.latitude.toFixed(5)}, ${selectedSpot.longitude.toFixed(5)}`,
                },
              });
            }}
          >
            <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">
              Ask AI about this spot
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
