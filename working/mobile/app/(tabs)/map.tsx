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
  StyleSheet,
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
        setScanError(msg);
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
    async (e: {
      nativeEvent: { coordinate: { latitude: number; longitude: number } };
    }) => {
      if (layersPopupVisible) {
        setLayersPopupVisible(false);
        return;
      }
      if (!OWM_KEY) return;
      const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
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
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("nav.oceanMap")}</Text>
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
    <SafeAreaView style={styles.safe}>
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t("nav.oceanMap")}</Text>
          <Text style={styles.headerSub}>
            {validMarkers.length} catches
            {alerts.length > 0 ? `  ·  ${alerts.length} alerts` : ""}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
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
          style={[styles.pillBtn, alertsVisible && styles.pillBtnAlert]}
          onPress={() => setAlertsVisible((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="warning-outline"
            size={12}
            color={alertsVisible ? "#f87171" : COLORS.textSecondary}
          />
          <Text
            style={[styles.pillBtnText, alertsVisible && { color: "#f87171" }]}
          >
            Alerts{alerts.length > 0 ? ` (${alerts.length})` : ""}
          </Text>
        </TouchableOpacity>

        <ProfileMenu size={34} />
      </View>

      {/* ── SUNRISE / SUNSET STRIP ────────────────────────────────────── */}
      {sunTimes && (
        <View style={styles.sunStrip}>
          <Ionicons name="sunny-outline" size={13} color={COLORS.accentLight} />
          <Text style={styles.sunText}>Rise {sunTimes.sunrise}</Text>
          <View style={styles.sunDivider} />
          <Ionicons name="moon-outline" size={13} color={COLORS.accentLight} />
          <Text style={styles.sunText}>Set {sunTimes.sunset}</Text>
          {safetyStatus && (
            <>
              <View style={styles.sunDivider} />
              <View
                style={[
                  styles.safetyBadge,
                  safetyStatus === "SAFE"
                    ? styles.safeBadge
                    : styles.unsafeBadge,
                ]}
              >
                <Text
                  style={[
                    styles.safetyText,
                    {
                      color:
                        safetyStatus === "SAFE"
                          ? COLORS.secondaryLight
                          : "#f87171",
                    },
                  ]}
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
        <View style={styles.legendBox}>
          <Text style={styles.legendLabel}>
            {currentScale.label} ({currentScale.unit})
          </Text>
          <View style={styles.legendBar}>
            {currentScale.stops.map((s, i) => (
              <View
                key={i}
                style={[styles.legendSegment, { backgroundColor: s.color }]}
              />
            ))}
          </View>
          <View style={styles.legendValues}>
            {currentScale.stops.map((s, i) => (
              <Text key={i} style={styles.legendValue}>
                {s.value}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* ── MAP ───────────────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
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
          mapType={Platform.OS === "android" ? "none" : "standard"}
        >
          <UrlTile urlTemplate={SATELLITE_TILE} maximumZ={20} tileSize={256} />

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
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      GRADE_COLOR[m.qualityGrade ?? ""] ?? GRADE_COLOR.Low,
                  },
                ]}
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
        <View style={styles.fabRight}>
          {/* Recenter */}
          <TouchableOpacity
            style={styles.fabSmall}
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Layers */}
          <TouchableOpacity
            style={[styles.fabSmall, activeLayer && styles.fabSmallActive]}
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
          <View style={styles.layersPopup}>
            <Text style={styles.layersPopupTitle}>Map Layer</Text>
            {LAYERS.map((layer) => (
              <TouchableOpacity
                key={layer.id}
                style={[
                  styles.layerRow,
                  activeLayer === layer.id && styles.layerRowActive,
                ]}
                onPress={() => {
                  setActiveLayer(activeLayer === layer.id ? null : layer.id);
                  setLayersPopupVisible(false);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.layerIconBox,
                    activeLayer === layer.id && styles.layerIconBoxActive,
                  ]}
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
                    style={[
                      styles.layerLabel,
                      activeLayer === layer.id && styles.layerLabelActive,
                    ]}
                  >
                    {layer.label}
                  </Text>
                  <Text style={styles.layerDesc}>{layer.desc}</Text>
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
                style={styles.layerClearBtn}
                onPress={() => {
                  setActiveLayer(null);
                  setLayersPopupVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.layerClearText}>Clear layer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── DEEP SCAN FAB (hidden while overlay is open) ──────────── */}
        {!scanOverlayVisible && (
          <View style={styles.fabScanWrapper}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.fabScan}
                onPress={startDeepScan}
                activeOpacity={0.85}
              >
                <Ionicons name="scan-outline" size={20} color="#fff" />
                <Text style={styles.fabScanLabel}>{scanFabLabel}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Small loading spinner */}
        {loadingMarkers && (
          <View style={styles.mapSpinner}>
            <ActivityIndicator size="small" color={COLORS.primaryLight} />
          </View>
        )}

        {/* ── GLASSMORPHIC ALERTS OVERLAY ───────────────────────────── */}
        {alertsVisible && (
          <View style={styles.alertsOverlay}>
            <View style={styles.alertsOverlayHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons name="warning-outline" size={14} color="#f87171" />
                <Text style={styles.alertsOverlayTitle}>Active Alerts</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAlertsVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            {alerts.length === 0 ? (
              <View style={styles.alertEmpty}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color={COLORS.secondaryLight}
                />
                <Text style={styles.alertEmptyText}>
                  No active alerts in your area
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 160 }}
                showsVerticalScrollIndicator={false}
              >
                {alerts.map((a) => (
                  <View key={a.id} style={styles.alertRow}>
                    <Ionicons
                      name={getAlertIcon(a.type) as any}
                      size={13}
                      color={getSeverityColor(a.severity)}
                    />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text
                        style={[
                          styles.alertTitle,
                          { color: getSeverityColor(a.severity) },
                        ]}
                        numberOfLines={1}
                      >
                        {a.title}
                      </Text>
                      <Text style={styles.alertDesc} numberOfLines={1}>
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
            style={[
              styles.tapCard,
              tapCard.cardX !== undefined && tapCard.cardY !== undefined
                ? { left: tapCard.cardX, top: tapCard.cardY }
                : { left: 12, top: 60 },
            ]}
          >
            {tapCard.loading ? (
              <View style={styles.tapCardRow}>
                <ActivityIndicator size="small" color={COLORS.primaryLight} />
                <Text style={styles.tapCardLoadText}>Fetching weather…</Text>
              </View>
            ) : (
              <>
                <View style={styles.tapCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tapCardCoords}>
                      {tapCard.lat.toFixed(4)}°N {tapCard.lng.toFixed(4)}°E
                    </Text>
                    {tapCard.description && (
                      <Text style={styles.tapCardDesc} numberOfLines={1}>
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
                <View style={styles.tapCardStats}>
                  {tapCard.temp !== undefined && (
                    <View style={styles.tapCardStat}>
                      <Ionicons
                        name="thermometer-outline"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.tapCardStatVal}>
                        {tapCard.temp.toFixed(1)}°C
                      </Text>
                    </View>
                  )}
                  {tapCard.wind !== undefined && (
                    <View style={styles.tapCardStat}>
                      <Ionicons
                        name="flag-outline"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.tapCardStatVal}>
                        {tapCard.wind} m/s
                      </Text>
                    </View>
                  )}
                  {tapCard.humidity !== undefined && (
                    <View style={styles.tapCardStat}>
                      <Ionicons
                        name="water-outline"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.tapCardStatVal}>
                        {tapCard.humidity}%
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.sendToAIBtn}
                  onPress={sendLocationToAI}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={12}
                    color="#fff"
                  />
                  <Text style={styles.sendToAIText}>Send to AI</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── GLASSMORPHIC DEEP SCAN OVERLAY ────────────────────────── */}
        {scanOverlayVisible && (
          <View style={styles.scanOverlay}>
            <View style={styles.scanHandle} />

            <View style={styles.scanOverlayHeader}>
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
                  <Text style={styles.scanOverlayTitle}>
                    {scanState === "done"
                      ? "Scan Complete"
                      : scanState === "cancelled"
                        ? "Scan Cancelled"
                        : scanState === "error"
                          ? "Scan Failed"
                          : "Deep Scan"}
                  </Text>
                  {scanState === "scanning" && scanProgress && (
                    <Text style={styles.scanOverlayStage}>
                      {SCAN_STAGE_LABELS[scanProgress.stage] ??
                        scanProgress.stage}
                    </Text>
                  )}
                </View>
              </View>
              {scanState === "scanning" ? (
                <TouchableOpacity
                  style={styles.scanCancelBtn}
                  onPress={cancelDeepScan}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={14} color="#f87171" />
                  <Text style={styles.scanCancelText}>Cancel</Text>
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
              <View style={styles.scanProgressBg}>
                <View
                  style={[
                    styles.scanProgressFill,
                    { width: `${scanProgress.pct}%` as any },
                  ]}
                />
              </View>
            )}

            {/* Done */}
            {scanState === "done" && (
              <View style={styles.scanResultBox}>
                <Ionicons
                  name="checkmark-circle"
                  size={28}
                  color={COLORS.secondaryLight}
                />
                <Text style={styles.scanResultText}>{scanSummary}</Text>
                <TouchableOpacity
                  style={styles.scanActionBtn}
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
                  <Text style={styles.scanActionBtnText}>View on Map</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error */}
            {scanState === "error" && (
              <View style={styles.scanResultBox}>
                <Ionicons name="alert-circle" size={28} color="#f87171" />
                <Text style={[styles.scanResultText, { color: "#f87171" }]}>
                  {scanError}
                </Text>
                <TouchableOpacity
                  style={styles.scanActionBtn}
                  onPress={() => {
                    dismissScan();
                    setTimeout(startDeepScan, 100);
                  }}
                >
                  <Ionicons name="refresh-outline" size={13} color="#fff" />
                  <Text style={styles.scanActionBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cancelled */}
            {scanState === "cancelled" && (
              <View style={styles.scanResultBox}>
                <Ionicons
                  name="stop-circle-outline"
                  size={28}
                  color={COLORS.textMuted}
                />
                <Text style={styles.scanResultText}>Scan was cancelled.</Text>
                <TouchableOpacity
                  style={styles.scanActionBtn}
                  onPress={() => {
                    dismissScan();
                    setTimeout(startDeepScan, 100);
                  }}
                >
                  <Ionicons name="search-outline" size={13} color="#fff" />
                  <Text style={styles.scanActionBtnText}>Start New Scan</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SSE live feed */}
            {scanState === "scanning" && (
              <ScrollView
                style={styles.scanFeed}
                ref={(ref) => {
                  if (ref)
                    setTimeout(() => ref.scrollToEnd({ animated: true }), 50);
                }}
                showsVerticalScrollIndicator={false}
              >
                {scanMessages.map((msg, i) => (
                  <View key={i} style={styles.scanFeedRow}>
                    <View
                      style={[
                        styles.scanFeedDot,
                        i === scanMessages.length - 1 &&
                          styles.scanFeedDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.scanFeedText,
                        i === scanMessages.length - 1 &&
                          styles.scanFeedTextActive,
                      ]}
                    >
                      {msg}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {scanState === "scanning" && (
              <Text style={styles.scanHint}>
                You can leave this page - you will be notified when the scan
                completes
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ── CATCH MARKER CARD (below map) ─────────────────────────────── */}
      {selectedMarker && (
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Text style={styles.infoTitle}>
              {selectedMarker.species ?? "Unknown Species"}
            </Text>
            <TouchableOpacity onPress={() => setSelectedMarker(null)}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.infoStats}>
            {(selectedMarker.weight_g ?? 0) > 0 && (
              <View style={styles.infoStat}>
                <Ionicons
                  name="scale-outline"
                  size={13}
                  color={COLORS.textMuted}
                />
                <Text style={styles.infoStatText}>
                  {((selectedMarker.weight_g as number) / 1000).toFixed(2)} kg
                </Text>
              </View>
            )}
            {selectedMarker.qualityGrade && (
              <View
                style={[
                  styles.gradeBadge,
                  {
                    backgroundColor:
                      (GRADE_COLOR[selectedMarker.qualityGrade] ??
                        GRADE_COLOR.Low) + "22",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gradeText,
                    {
                      color:
                        GRADE_COLOR[selectedMarker.qualityGrade] ??
                        GRADE_COLOR.Low,
                    },
                  ]}
                >
                  {selectedMarker.qualityGrade}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.infoMeta}>
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
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>{selectedSpot.name}</Text>
              <Text style={styles.infoSubtitle}>
                {selectedSpot.type} · {selectedSpot.distance_km} km away
              </Text>
              {selectedSpot.parent_water_body ? (
                <Text style={[styles.infoSubtitle, { marginTop: 2 }]}>
                  {selectedSpot.parent_water_body}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setSelectedSpot(null)}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.confidenceBox}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text
                style={[styles.confidenceScore, { color: selectedSpot.color }]}
              >
                {selectedSpot.confidence}
                <Text style={styles.confidenceMax}> / 100</Text>
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${selectedSpot.confidence}%` as any,
                    backgroundColor: selectedSpot.color,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.infoStats}>
            <View style={styles.scoreTile}>
              <Ionicons
                name="fish-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text style={styles.scoreTileLabel}>Fish Density</Text>
              <Text style={styles.scoreTileValue}>
                {selectedSpot.fish_density_score}/100
              </Text>
            </View>
            <View style={styles.scoreTile}>
              <Ionicons
                name="partly-sunny-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text style={styles.scoreTileLabel}>Weather</Text>
              <Text style={styles.scoreTileValue}>
                {selectedSpot.weather_score}/100
              </Text>
            </View>
            <View style={styles.scoreTile}>
              <Ionicons
                name="navigate-outline"
                size={12}
                color={COLORS.textMuted}
              />
              <Text style={styles.scoreTileLabel}>Access</Text>
              <Text style={styles.scoreTileValue}>
                {selectedSpot.transport_score}/100
              </Text>
            </View>
          </View>
          {selectedSpot.gemini_web_score != null && (
            <View style={styles.infoStats}>
              <View style={styles.scoreTile}>
                <Ionicons
                  name="globe-outline"
                  size={12}
                  color={COLORS.textMuted}
                />
                <Text style={styles.scoreTileLabel}>Web Score</Text>
                <Text style={styles.scoreTileValue}>
                  {selectedSpot.gemini_web_score}/100
                </Text>
              </View>
            </View>
          )}
          {selectedSpot.chlorophyll_available && (
            <View style={styles.chloTag}>
              <Ionicons name="water-outline" size={12} color="#22d3ee" />
              <Text style={styles.chloTagText}>Chlorophyll data included</Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgDark,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  pillBtnAlert: { borderColor: "#f8717155", backgroundColor: "#f8717114" },
  pillBtnText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
  },

  // Sun strip
  sunStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sunText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  sunDivider: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  safetyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  safeBadge: { backgroundColor: COLORS.secondaryLight + "20" },
  unsafeBadge: { backgroundColor: "#f8717120" },
  safetyText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.3,
  },

  // Alerts (glassmorphic overlay inside mapContainer)
  alertsOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 40,
    backgroundColor: "rgba(10,15,30,0.90)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: SPACING.sm,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  alertsOverlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertsOverlayTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  alertEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  alertEmptyText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  alertTitle: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  alertDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Legend
  legendBox: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  legendLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  legendBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
  },
  legendSegment: { flex: 1 },
  legendValues: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  legendValue: {
    fontSize: 9,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.bold,
  },

  // Map
  mapContainer: { flex: 1, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  mapSpinner: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    backgroundColor: COLORS.bgCard + "dd",
    borderRadius: RADIUS.full,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 5,
  },

  // Right FAB column
  fabRight: {
    position: "absolute",
    right: 12,
    bottom: 80,
    gap: 8,
    alignItems: "center",
    zIndex: 50,
  },
  fabSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  fabSmallActive: {
    borderColor: COLORS.primaryLight + "55",
    backgroundColor: COLORS.primaryLight + "18",
  },

  // Layers popup
  layersPopup: {
    position: "absolute",
    right: 62,
    bottom: 56,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    width: 210,
    zIndex: 60,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  layersPopupTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginBottom: 2,
  },
  layerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  layerRowActive: { backgroundColor: COLORS.primaryLight + "12" },
  layerIconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  layerIconBoxActive: { backgroundColor: COLORS.primaryLight + "22" },
  layerLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
  },
  layerLabelActive: { color: COLORS.primaryLight },
  layerDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  layerClearBtn: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  layerClearText: {
    fontSize: FONTS.sizes.xs,
    color: "#f87171",
    fontWeight: FONTS.weights.semibold,
  },

  // Deep Scan FAB
  fabScanWrapper: { position: "absolute", left: 16, bottom: 20, zIndex: 50 },
  fabScan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 28,
    paddingVertical: 13,
    paddingHorizontal: 20,
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  fabScanLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Hovering tap location card (absolute inside mapContainer)
  tapCard: {
    position: "absolute",
    width: 220,
    zIndex: 30,
    backgroundColor: "rgba(10,15,30,0.92)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: SPACING.sm,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
  },
  tapCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  tapCardLoadText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  tapCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tapCardCoords: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  tapCardDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: "capitalize",
  },
  tapCardStats: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: "wrap",
  },
  tapCardStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  tapCardStatVal: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  sendToAIBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  sendToAIText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: "#fff",
  },

  // Deep Scan glassmorphic overlay (bottom 52% of mapContainer)
  scanOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "52%",
    zIndex: 20,
    backgroundColor: "rgba(8,12,26,0.94)",
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  scanHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: SPACING.sm,
  },
  scanOverlayHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  scanOverlayTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  scanOverlayStage: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primaryLight,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  scanCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "#f8717155",
    backgroundColor: "#f8717112",
  },
  scanCancelText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: "#f87171",
  },

  // Progress bar
  scanProgressBg: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: SPACING.sm,
  },
  scanProgressFill: {
    height: 3,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 2,
  },

  // Scan result states
  scanResultBox: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  scanResultText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  scanActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.xs,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  scanActionBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: "#fff",
  },

  // SSE message feed
  scanFeed: { flex: 1, marginBottom: SPACING.xs },
  scanFeedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  scanFeedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textSubtle,
    marginTop: 5,
  },
  scanFeedDotActive: {
    backgroundColor: COLORS.primaryLight,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scanFeedText: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
  scanFeedTextActive: {
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  scanHint: {
    fontSize: 10,
    color: COLORS.textSubtle,
    textAlign: "center",
    lineHeight: 15,
  },

  // Info cards (below map)
  infoCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  infoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  infoTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  infoSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: "capitalize",
  },
  infoStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    flexWrap: "wrap",
  },
  infoStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoStatText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  infoMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    marginTop: 4,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  gradeText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

  // Spot detail
  confidenceBox: { marginTop: SPACING.sm, marginBottom: SPACING.xs },
  confidenceLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confidenceScore: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
  confidenceMax: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: "400",
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.bgSurface,
    marginTop: 4,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3 },
  scoreTile: {
    flex: 1,
    alignItems: "center",
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgSurface,
    gap: 3,
  },
  scoreTileLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  scoreTileValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  chloTag: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  chloTagText: { fontSize: FONTS.sizes.xs, color: "#22d3ee" },
});
