"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Waves, Thermometer, Filter,
  Droplets, Maximize2, Navigation,
  Crosshair, Loader2, MapPin, Wind, X, AlertTriangle,
  Sun,
  Sunset, Sparkles, CheckCircle2, Radio, MessageSquare
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getMapData,
  streamFishingSpots
} from "@/lib/api-client";
import type {
  MapMarker, FishingSpot,
  FishingSpotsProgressEvent,
  FishingSpotsStreamEvent
} from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { useAgentContext } from '@/lib/stores/agent-context-store';
import {
  fetchLiveAlerts,
  getActiveAlerts,
  computeSafetyStatus,
  getSeverityColor,
} from "@/lib/alerts";
import type { DisasterAlert } from "@/lib/alerts";
import type { PaneMessage } from "@/types/agent-first";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  ScaleControl,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import MapEventsWrapper from '@/components/map/MapEventsWrapper';
import UserLocationMarker from '@/components/map/UserLocationMarker';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Map Config ────────────────────────────────────────────────────────────────
const MAP_URL = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";

// India bounds - restrict panning to Indian subcontinent + surrounding ocean
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [4.0, 64.0],   // SW corner
  [38.0, 100.0],  // NE corner
];
const INDIA_CENTER: [number, number] = [20.5937, 78.9629]; // Geographic center of India

const OPENWEATHER_LAYER_BY_ACTIVE_LAYER: Record<string, string | null> = {
  temp: "temp_new",
  currents: "wind_new",
  salinity: "pressure_new",
};

// ── Weather Scale Configs ─────────────────────────────────────────────────────
const getWeatherScales = (t: any): Record<string, { label: string; unit: string; stops: { color: string; value: string }[] } | null> => ({
  temp: {
    label: t("map.temperature"), unit: "°C",
    stops: [
      { color: "#821692", value: "-40" }, { color: "#0000ff", value: "-20" },
      { color: "#00d4ff", value: "0" }, { color: "#00ff00", value: "10" },
      { color: "#ffff00", value: "20" }, { color: "#ff8c00", value: "30" },
      { color: "#ff0000", value: "40" },
    ],
  },
  currents: {
    label: t("map.windSpeed"), unit: "m/s",
    stops: [
      { color: "#ffffff", value: "0" }, { color: "#aef1f9", value: "5" },
      { color: "#4dc9f6", value: "10" }, { color: "#1a9edb", value: "15" },
      { color: "#ff8c00", value: "25" }, { color: "#ff0000", value: "35" },
      { color: "#8b0000", value: "50" },
    ],
  },
  salinity: {
    label: t("map.pressure"), unit: "hPa",
    stops: [
      { color: "#0000ff", value: "950" }, { color: "#00bfff", value: "980" },
      { color: "#00ff00", value: "1000" }, { color: "#ffff00", value: "1013" },
      { color: "#ff8c00", value: "1030" }, { color: "#ff0000", value: "1050" },
      { color: "#8b0000", value: "1080" },
    ],
  },
});

interface ClickedWeather {
  lat: number; lng: number;
  temp?: number; feelsLike?: number; wind?: number; windDeg?: number;
  humidity?: number; description?: string; icon?: string; loading: boolean;
}

/* ── Per-marker weather popup ─────────────────────────────────────────────── */
function CatchWeatherPopup({ marker }: { marker: MapMarker }) {
  const { t } = useLanguage();
  const [weather, setWeather] = useState<any>(null);
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;

  useEffect(() => {
    if (!apiKey) return;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${marker.latitude}&lon=${marker.longitude}&appid=${apiKey}&units=metric`)
      .then(r => r.json()).then(setWeather).catch(console.error);
  }, [marker, apiKey]);

  return (
    <div className="p-2 space-y-2 min-w-[200px]">
      <h3 className="font-bold text-base text-primary mr-2">{marker.species ?? t("map.unknownSpecies")}</h3>
      <div className="flex gap-2 text-xs">
        {marker.weight_g && <Badge variant="outline" className="border-none bg-muted">{`${(marker.weight_g / 1000).toFixed(2)} kg`}</Badge>}
      </div>
      {weather?.main ? (
        <div className="pt-2 mt-2 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
          <div className="flex justify-between"><span>{t("map.conditions")}</span><span className="text-foreground capitalize">{weather.weather[0]?.description}</span></div>
          <div className="flex justify-between"><span>{t("map.temp")}</span><span className="text-foreground font-semibold">{weather.main.temp}°C</span></div>
          <div className="flex justify-between"><span>{t("map.wind")}</span><span className="text-foreground">{weather.wind.speed} m/s</span></div>
        </div>
      ) : (
        <div className="pt-2 text-[10px] text-muted-foreground italic">{apiKey ? t("map.loadingWeather") : t("map.weatherApiMissing")}</div>
      )}
      <p className="text-[9px] text-muted-foreground pt-2 text-right">{new Date(marker.createdAt).toLocaleDateString()}</p>
    </div>
  );
}


/* ── Weather scale legend ─────────────────────────────────────────────────── */
function WeatherScaleLegend({ scale }: { scale: { label: string; unit: string; stops: { color: string; value: string }[] } }) {
  const gradient = scale.stops.map(s => s.color).join(", ");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest">{scale.label} ({scale.unit})</span>
      <div className="h-3 w-full rounded-full" style={{ background: `linear-gradient(to right, ${gradient})` }} />
      <div className="flex justify-between text-[8px] font-bold text-white/60">
        {scale.stops.map((s, i) => <span key={i}>{s.value}</span>)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAP COMPONENT PROPS
   ══════════════════════════════════════════════════════════════════════════════ */
export interface MapComponentProps {
  onPaneMessage: (message: PaneMessage) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  highlightSpecies?: string;
  /** When set, the map flies to this location and drops a marker */
  flyToLocation?: { lat: number; lon: number; _t?: number };
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAP COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function MapComponent({
  onPaneMessage,
  initialCenter = INDIA_CENTER,
  initialZoom = 9,
  highlightSpecies,
  flyToLocation
}: MapComponentProps) {
  const { t } = useLanguage();
  const setMapPointContext = useAgentContext(s => s.setSelectedMapPoint);
  const setContextPage = useAgentContext(s => s.setCurrentPage);
  const [activeLayer, setActiveLayer] = useState<keyof typeof OPENWEATHER_LAYER_BY_ACTIVE_LAYER | null>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [sunTimes, setSunTimes] = useState<{ sunrise: string; sunset: string } | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string>(highlightSpecies || "all");
  const [isLoading, setIsLoading] = useState(true);
  const [clickedWeather, setClickedWeather] = useState<ClickedWeather | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [fishingSpots, setFishingSpots] = useState<FishingSpot[]>([]);
  const [fishingSpotsLoading, setFishingSpotsLoading] = useState(false);
  const [showFishingSpots, setShowFishingSpots] = useState(false);
  const [locationResolved, setLocationResolved] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const openWeatherApiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY || "";

  // ── SSE scan state ───────────────────────────────────────────────────────
  type ScanLogEntry = { stage: string; message: string; pct: number; ts: number };
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
  const [scanPct, setScanPct] = useState(0);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [showScanPanel, setShowScanPanel] = useState(false);
  const [isScanPanelMinimized, setIsScanPanelMinimized] = useState(false);
  const scanAbortRef = useRef<AbortController | null>(null);
  const scanLogRef = useRef<HTMLDivElement>(null);

  // Ref to hold latest handleMapClick so the flyTo effect can call it safely
  const handleMapClickRef = useRef<(pos: { lat: number; lng: number }) => void>(undefined);

  // ── Fly to a specific location when flyToLocation prop changes ──────────
  const prevFlyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !flyToLocation ||
      typeof flyToLocation.lat !== 'number' ||
      typeof flyToLocation.lon !== 'number' ||
      isNaN(flyToLocation.lat) ||
      isNaN(flyToLocation.lon)
    ) return;
    const key = `${flyToLocation.lat},${flyToLocation.lon},${flyToLocation._t ?? 0}`;
    if (prevFlyRef.current === key) return;
    prevFlyRef.current = key;

    const fly = () => {
      if (!mapInstanceRef.current) return;
      mapInstanceRef.current.flyTo([flyToLocation.lat, flyToLocation.lon], 12, { duration: 1.5 });
      
      setMapPointContext({ lat: flyToLocation.lat, lon: flyToLocation.lon });
      setClickedWeather({ lat: flyToLocation.lat, lng: flyToLocation.lon, loading: !!openWeatherApiKey });
      
      if (openWeatherApiKey) {
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${flyToLocation.lat}&lon=${flyToLocation.lon}&appid=${openWeatherApiKey}&units=metric`)
          .then(res => res.json())
          .then(data => {
            setClickedWeather({
              lat: flyToLocation.lat, lng: flyToLocation.lon,
              temp: data.main?.temp, feelsLike: data.main?.feels_like,
              wind: data.wind?.speed, windDeg: data.wind?.deg,
              humidity: data.main?.humidity,
              description: data.weather?.[0]?.description,
              icon: data.weather?.[0]?.icon, loading: false,
            });
          })
          .catch(() => setClickedWeather(null));
      }
    };

    // If the map is already ready, fly immediately; otherwise wait a tick
    if (mapInstanceRef.current) {
      fly();
    } else {
      const timer = setTimeout(fly, 600);
      return () => clearTimeout(timer);
    }
  }, [flyToLocation]); // handleMapClick is stable via useCallback

  useEffect(() => {
    setIsClientMounted(true);
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setShowLegend(!mobile);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Alerts (live from OpenWeatherMap) ────────────────────────────────────────
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const activeAlerts = useMemo(() => getActiveAlerts(alerts), [alerts]);
  const safetyStatus = useMemo(() => {
    if (!userLocation) return null;
    return computeSafetyStatus(userLocation.lat, userLocation.lng, activeAlerts);
  }, [userLocation, activeAlerts]);

  // Request user location on mount for centering
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isNaN(position.coords.latitude) && !isNaN(position.coords.longitude)) {
            setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          }
          setLocationResolved(true);
        },
        () => {
          // Location permission denied or unavailable - fallback to default center
          setLocationResolved(true);
        },
        { timeout: 5000 }
      );
    } else {
      setLocationResolved(true);
    }
  }, []);

  // Fetch live alerts on mount
  useEffect(() => {
    if (!openWeatherApiKey) { setAlertsLoading(false); return; }
    fetchLiveAlerts(openWeatherApiKey)
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setAlertsLoading(false));
    const interval = setInterval(() => {
      fetchLiveAlerts(openWeatherApiKey).then(setAlerts).catch(console.error);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [openWeatherApiKey]);

  // Fetch sunrise/sunset on mount
  useEffect(() => {
    if (!openWeatherApiKey) return;
    const fetchSunTimes = async () => {
      try {
        const lat = userLocation ? userLocation.lat : initialCenter[0];
        const lon = userLocation ? userLocation.lng : initialCenter[1];
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}`);
        const data = await res.json();
        if (data.sys?.sunrise && data.sys?.sunset) {
          const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setSunTimes({ sunrise: formatTime(data.sys.sunrise), sunset: formatTime(data.sys.sunset) });
        }
      } catch (err) { console.error("Failed to fetch sun times:", err); }
    };
    fetchSunTimes();
  }, [userLocation, initialCenter, openWeatherApiKey]);

  // ── Map bounds ──────────────────────────────────────────────────────────────
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  const validMarkers = useMemo(
    () => markers.filter(m => Number.isFinite(m.latitude) && Number.isFinite(m.longitude)),
    [markers]
  );

  const visibleMarkers = useMemo(() => {
    if (!mapBounds) return validMarkers;
    return validMarkers.filter(m =>
      m.latitude >= mapBounds.south && m.latitude <= mapBounds.north &&
      m.longitude >= mapBounds.west && m.longitude <= mapBounds.east
    );
  }, [validMarkers, mapBounds]);

  const openWeatherLayer = useMemo(() => {
    if (!activeLayer || !openWeatherApiKey) return null;
    const layer = OPENWEATHER_LAYER_BY_ACTIVE_LAYER[activeLayer];
    return `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${openWeatherApiKey}`;
  }, [activeLayer, openWeatherApiKey]);

  const currentScale = useMemo(() => {
    if (!activeLayer) return null;
    return getWeatherScales(t)[activeLayer];
  }, [activeLayer, t]);

  const handleMapReady = useCallback((map: any) => { mapInstanceRef.current = map; }, []);

  const handleFullscreen = useCallback(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  }, []);

  const handleLocateUser = useCallback(() => {
    if (!mapInstanceRef.current) return;
    if (userLocation) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 10, { duration: 1.5 });
      // Call the manual click handler to drop the pin at the current location
      if (handleMapClickRef.current) handleMapClickRef.current({ lat: userLocation.lat, lng: userLocation.lng });
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapInstanceRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 10, { duration: 1.5 });
          if (handleMapClickRef.current) handleMapClickRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => { }
      );
    }
  }, [userLocation]);

  const handleResetView = useCallback(() => {
    if (!mapInstanceRef.current) return;
    if (userLocation) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 9, { duration: 1.2 });
      if (handleMapClickRef.current) handleMapClickRef.current({ lat: userLocation.lat, lng: userLocation.lng });
    } else {
      mapInstanceRef.current.flyTo(INDIA_CENTER, 5, { duration: 1.2 });
      setClickedWeather(null);
    }
  }, [userLocation]);

  const mousePos = useRef({ lat: 16.0, lng: 72.0 });
  const coordsRef = useRef<HTMLSpanElement>(null);
  const mouseMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMouseMove = useCallback((pos: { lat: number; lng: number }) => {
    if (mouseMoveTimer.current) clearTimeout(mouseMoveTimer.current);
    mouseMoveTimer.current = setTimeout(() => {
      mousePos.current = pos;
      if (coordsRef.current) {
        coordsRef.current.textContent = `${pos.lat.toFixed(4)}°N, ${pos.lng.toFixed(4)}°E`;
      }
    }, 50);
  }, []);

  // ── PaneMessage dispatch handlers ─────────────────────────────────────────
  const handleMapClick = useCallback(async (pos: { lat: number; lng: number }) => {
    // Sync map click to agent context
    setMapPointContext({ lat: pos.lat, lon: pos.lng });

    // Dispatch PaneMessage for map click
    onPaneMessage({
      id: `map-click-${Date.now()}`,
      type: 'query',
      source: 'map',
      payload: {
        latitude: pos.lat,
        longitude: pos.lng,
        action: 'click'
      },
      timestamp: Date.now(),
      metadata: {
        userInitiated: true,
        requiresResponse: true
      }
    });

    // Also fetch weather for the clicked location
    if (!openWeatherApiKey) return;
    setClickedWeather({ lat: pos.lat, lng: pos.lng, loading: true });
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${pos.lat}&lon=${pos.lng}&appid=${openWeatherApiKey}&units=metric`);
      const data = await res.json();
      setClickedWeather({
        lat: pos.lat, lng: pos.lng,
        temp: data.main?.temp, feelsLike: data.main?.feels_like,
        wind: data.wind?.speed, windDeg: data.wind?.deg,
        humidity: data.main?.humidity,
        description: data.weather?.[0]?.description,
        icon: data.weather?.[0]?.icon, loading: false,
      });
    } catch { setClickedWeather(null); }
  }, [openWeatherApiKey, onPaneMessage]);
  // Keep ref in sync for the flyTo effect
  handleMapClickRef.current = handleMapClick;

  const handleMoveEnd = useCallback((bounds: { north: number; south: number; east: number; west: number }) => {
    setMapBounds(bounds);

    // Dispatch PaneMessage for bounds change
    if (mapInstanceRef.current) {
      onPaneMessage({
        id: `map-bounds-${Date.now()}`,
        type: 'info',
        source: 'map',
        payload: {
          bounds,
          zoom: mapInstanceRef.current.getZoom()
        },
        timestamp: Date.now(),
        metadata: {
          userInitiated: true,
          requiresResponse: false
        }
      });
    }
  }, [onPaneMessage]);

  const hasAutoPinnedRef = useRef(false);

  const handleLocationFound = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng });
    if (!hasAutoPinnedRef.current && !flyToLocation) {
      hasAutoPinnedRef.current = true;
      if (handleMapClickRef.current) {
        handleMapClickRef.current({ lat, lng });
      }
    }
  }, [flyToLocation]);

  const handleFetchFishingSpots = useCallback(async () => {
    // If there is a manually clicked pin on the map, prioritize that, else fallback to userLocation, else map center.
    const loc = clickedWeather ?? userLocation ?? (mapInstanceRef.current
      ? (() => { const c = mapInstanceRef.current.getCenter(); return { lat: c.lat, lng: c.lng }; })()
      : null);
    if (!loc) return;

    // Cancel any previous scan
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;

    // Reset scan state
    setScanLog([]);
    setScanPct(0);
    setScanDone(false);
    setScanError(null);
    setScanSummary(null);
    setShowScanPanel(true);
    setIsScanPanelMinimized(false);
    setFishingSpotsLoading(true);
    setShowFishingSpots(true);

    // Request notification permission up-front
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }

    try {
      const result = await streamFishingSpots(
        loc.lat, loc.lng, 50,
        (event: FishingSpotsStreamEvent) => {
          if (event.type === 'progress') {
            const prog = event as FishingSpotsProgressEvent;
            setScanPct(prog.pct);
            setScanLog(prev => [
              ...prev,
              { stage: prog.stage, message: prog.message, pct: prog.pct, ts: Date.now() }
            ]);
            // auto-scroll log
            setTimeout(() => {
              if (scanLogRef.current) {
                scanLogRef.current.scrollTop = scanLogRef.current.scrollHeight;
              }
            }, 30);
          }
        },
        controller.signal,
      );

      setFishingSpots(result.spots || []);
      setScanSummary(result.summary);
      setScanDone(true);
      setScanPct(100);

      // Browser notification
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('🎣 Deep Scan Complete', {
          body: result.summary,
          icon: '/logo.png',
        });
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setScanError(e?.message || 'Scan failed');
        console.error('Fishing spots stream error:', e);
      }
    } finally {
      setFishingSpotsLoading(false);
    }
  }, [userLocation, clickedWeather]);

  // Handle layer change with PaneMessage
  const handleLayerChange = useCallback((layerId: keyof typeof OPENWEATHER_LAYER_BY_ACTIVE_LAYER) => {
    const nextLayer = activeLayer === layerId ? null : layerId;
    setActiveLayer(nextLayer);

    onPaneMessage({
      id: `map-layer-${Date.now()}`,
      type: 'action',
      source: 'map',
      payload: {
        layer: layerId,
        enabled: nextLayer === layerId
      },
      timestamp: Date.now(),
      metadata: {
        userInitiated: true,
        requiresResponse: false
      }
    });
  }, [activeLayer, onPaneMessage]);

  // Handle marker click with PaneMessage
  const handleMarkerClick = useCallback((marker: MapMarker) => {
    onPaneMessage({
      id: `map-marker-${Date.now()}`,
      type: 'query',
      source: 'map',
      payload: {
        imageId: marker.imageId,
        species: marker.species,
        weight: marker.weight_g ? marker.weight_g / 1000 : undefined,
        latitude: marker.latitude,
        longitude: marker.longitude,
        createdAt: marker.createdAt
      },
      timestamp: Date.now(),
      metadata: {
        userInitiated: true,
        requiresResponse: true
      }
    });
  }, [onPaneMessage]);

  useEffect(() => {
    const fetchMarkers = async () => {
      setIsLoading(true);
      try {
        const { markers: data } = await getMapData({ species: selectedSpecies !== "all" ? selectedSpecies : undefined });
        setMarkers(data);
      } catch (err) { console.error("Failed to load map data:", err); }
      finally { setIsLoading(false); }
    };
    fetchMarkers();
  }, [selectedSpecies]);

  const getMarkerColor = (grade?: string) => {
    if (grade === "Premium") return "#10b981";
    if (grade === "Standard") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 h-full min-h-0">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="w-full order-2">
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-sm p-2.5 sm:p-3 space-y-2.5">
          {/* <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold leading-tight">Map Command Center</h3>
              <p className="text-[10px] text-muted-foreground">Live marine intelligence and catch zones</p>
            </div>
            <Badge variant="outline" className="h-6 rounded-full border-primary/20 bg-primary/5 text-primary text-[10px]">
              {validMarkers.length} catches
            </Badge>
          </div> */}

          <div className="space-y-2 animate-fade-in text-xs">
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2">{t("map.layers")}</h4>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'temp', label: t("map.temperature"), icon: Thermometer },
                  { id: 'currents', label: t("map.currents"), icon: Waves },
                  { id: 'salinity', label: t("map.salinity"), icon: Droplets },
                ].map((layer) => (
                  <Button
                    key={layer.id}
                    variant={activeLayer === layer.id ? "secondary" : "ghost"}
                    className={cn(
                      "flex-1 sm:flex-none justify-start gap-1.5 rounded-lg h-9 px-3 transition-all text-[11px] border",
                      activeLayer === layer.id ? "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
                    )}
                    onClick={() => handleLayerChange(layer.id as keyof typeof OPENWEATHER_LAYER_BY_ACTIVE_LAYER)}
                  >
                    <layer.icon className="w-3.5 h-3.5" />
                    <span className="font-semibold truncate">{layer.label}</span>
                  </Button>
                ))}

                {/* Alerts */}
                <Button
                  variant={showAlerts ? "secondary" : "ghost"}
                  className={cn(
                    "flex-1 sm:flex-none justify-start gap-1.5 rounded-lg h-9 px-3 transition-all text-[11px] border",
                    showAlerts ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-sm" : "border-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  )}
                  onClick={() => setShowAlerts(!showAlerts)}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="font-semibold truncate">{t("map.liveAlerts")}</span>
                </Button>

                {/* Scan Button Action */}
                <Button
                  className={cn(
                    "flex-1 sm:flex-none justify-center gap-1.5 rounded-lg h-9 px-4 transition-all text-[11px] font-bold shadow-sm",
                    fishingSpotsLoading
                      ? "bg-secondary text-secondary-foreground opacity-70 cursor-not-allowed border border-transparent"
                      : showFishingSpots
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent"
                        : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-600 hover:to-emerald-500 border border-emerald-500/30 shadow-emerald-500/20"
                  )}
                  onClick={fishingSpotsLoading ? () => {
                    scanAbortRef.current?.abort();
                    setFishingSpotsLoading(false);
                    setScanDone(true);
                  } : handleFetchFishingSpots}
                >
                  {fishingSpotsLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t("map.scanning")}</>
                  ) : showFishingSpots ? (
                    <><Crosshair className="w-3.5 h-3.5" />{t("map.rescanConfig")}</>
                  ) : (
                    <><Crosshair className="w-3.5 h-3.5" />{t("map.scanFishingSpots")}</>
                  )}
                </Button>

                {/* Daily Sun Info */}
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 space-y-1">
                  <div className="flex items-center gap-1.5"><Sun className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-amber-500/90">{t("map.sunrise")}</span></div>
                  <p className="text-xs font-bold text-foreground">{sunTimes?.sunrise || t("map.loading")}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 space-y-1">
                  <div className="flex items-center gap-1.5"><Sunset className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-amber-500/90">{t("map.sunset")}</span></div>
                  <p className="text-xs font-bold text-foreground">{sunTimes?.sunset || t("map.loading")}</p>
                </div>

              </div>
            </div>

            {/* ── Inline Fishing Scan Progress Panel ──────────── */}
            {showScanPanel && (
              <div className="mt-2.5 pt-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className={cn(
                  "rounded-xl border shadow-sm overflow-hidden transition-all duration-500",
                  scanDone ? "border-emerald-500/30 bg-emerald-500/5"
                    : scanError ? "border-red-500/30 bg-red-500/5"
                      : "border-primary/30 bg-primary/5"
                )}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/20">
                    <div className="flex items-center gap-2.5">
                      {scanDone ? (
                        <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /></div>
                      ) : scanError ? (
                        <div className="p-1 rounded-full bg-red-500/20 text-red-500"><AlertTriangle className="w-3.5 h-3.5" /></div>
                      ) : (
                        <div className="p-1 rounded-full bg-primary/20 text-primary relative">
                          <Radio className="w-3.5 h-3.5 relative z-10 animate-pulse" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold tracking-widest uppercase"
                          style={{ color: scanDone ? '#10b981' : scanError ? '#ef4444' : '#3b82f6' }}>
                          {scanDone ? 'Deep Scan Complete' : scanError ? 'Scan Failed' : 'Deep Scan Running'}
                        </span>
                        {!scanDone && !scanError && <span className="text-[10px] text-muted-foreground font-mono">{t("map.analyzingMarineConditions")}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-3 pb-2.5 pt-2">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[10px] text-muted-foreground font-bold tracking-wide uppercase truncate max-w-[80%]">
                        {scanLog.length > 0 ? scanLog[scanLog.length - 1]?.stage : t("map.init")}
                      </span>
                      <span className="text-[10px] text-foreground font-mono font-bold">{scanPct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden relative border border-black/5">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          !scanDone && !scanError && "bg-primary relative"
                        )}
                        style={{
                          width: `${scanPct}%`,
                          ...(scanDone ? { background: 'linear-gradient(90deg, #10b981, #34d399)' } : {}),
                          ...(scanError ? { background: '#ef4444' } : {})
                        }}
                      >
                        {!scanDone && !scanError && (
                          <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite] -translate-x-full" style={{ animation: 'shimmer 2s infinite' }}></div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Log area */}
                  <div
                    ref={scanLogRef}
                    className="px-3 pb-3 space-y-2 max-h-[160px] overflow-y-auto"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'var(--border) transparent',
                    }}
                  >
                    {scanLog.length === 0 && !scanError && (
                      <p className="text-[10px] text-muted-foreground italic pl-1">{t("map.initialisingScanEngine")}</p>
                    )}
                    {scanLog.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 text-[10.5px] pl-1.5"
                        style={{ opacity: i === scanLog.length - 1 ? 1 : 0.5 + (i / scanLog.length) * 0.5 }}
                      >
                        <span
                          className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{
                            background:
                              entry.stage === 'done' || entry.stage === 'finalise' ? '#10b981' // emerald
                                : entry.stage === 'scan' ? '#3b82f6' // primary blue
                                  : entry.stage === 'history' ? '#c084fc' // lighter purple for contrast
                                    : entry.stage === 'osm' ? '#fbbf24' // lighter amber for contrast
                                      : '#93c5fd', // lighter blue for default
                          }}
                        />
                        <span className="text-foreground leading-snug">{entry.message}</span>
                      </div>
                    ))}
                    {scanError && (
                      <div className="flex items-start gap-2 text-[10px] text-red-500 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{scanError}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary on completion */}
                  {scanDone && scanSummary && (
                    <div className="mx-3 mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-medium flex gap-1.5 items-start">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                        {scanSummary}
                      </p>
                    </div>
                  )}

                  {/* Ask Matsya AI about scan results */}
                  {scanDone && scanSummary && (
                    <div className="mx-3 mb-3">
                      <button
                        onClick={() => {
                          const loc = userLocation ?? (mapInstanceRef.current
                            ? (() => { const c = mapInstanceRef.current.getCenter(); return { lat: c.lat, lng: c.lng }; })()
                            : null);
                          if (loc) {
                            setMapPointContext({ lat: loc.lat, lon: loc.lng });
                            setContextPage('map');
                          }
                          const topSpots = fishingSpots
                            .slice(0, 5)
                            .map(s => `${s.name} (${s.type}, confidence: ${s.confidence}%, density: ${s.fish_density_score}, weather: ${s.weather_score}, distance: ${s.distance_km.toFixed(1)}km)`)
                            .join('; ');
                          const prompt = `Deep scan results summary: ${scanSummary}. Top spots: ${topSpots}. Based on these fishing spot scan results, which spot would you recommend and why? Include weather conditions and best time to go.`;
                          (window as any).__agentChatInject?.(
                            'Analyze my scan results',
                            {
                              label: 'Analyze my scan results',
                              detail: `${fishingSpots.length} spots found`,
                              icon: 'map' as const,
                              backendText: prompt,
                            }
                          );
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />{t("map.askAIResults")}</button>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Map ──────────────────────────────────────────────────── */}
      <div ref={mapContainerRef} className="relative rounded-2xl overflow-hidden border border-border/50 bg-muted/20 shadow-2xl h-[48vh] sm:h-[58vh] lg:h-[66vh] xl:h-[72vh] order-1 min-h-[320px] w-full">
        {/* Loading overlay for Deep Scan */}
        {fishingSpotsLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-primary/20 bg-background/80 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-xl bg-primary/30 animate-pulse" />
                <Crosshair className="w-8 h-8 text-primary animate-[spin_3s_linear_infinite]" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-sm text-foreground tracking-wide uppercase">{t("map.deepScanActive")}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{t("map.analyzingSurroundingArea")}</p>
              </div>
            </div>
          </div>
        )}

        {!isClientMounted || !locationResolved || isLoading ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/30 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs font-medium text-muted-foreground">{t("map.initializingMap")}</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={(userLocation && !isNaN(userLocation.lat) && !isNaN(userLocation.lng)) ? [userLocation.lat, userLocation.lng] : (!isNaN(initialCenter[0]) && !isNaN(initialCenter[1]) ? initialCenter : INDIA_CENTER)}
            zoom={initialZoom}
            zoomControl={false}
            minZoom={4}
            preferCanvas={true}
            dragging={!fishingSpotsLoading}
            touchZoom={!fishingSpotsLoading}
            doubleClickZoom={!fishingSpotsLoading}
            scrollWheelZoom={!fishingSpotsLoading}
            boxZoom={!fishingSpotsLoading}
            keyboard={!fishingSpotsLoading}
            className="w-full h-full z-10"
            style={{ background: '#0a1628' }}
          >
            <TileLayer
              attribution="&copy; Google Maps"
              url={MAP_URL}
              maxZoom={20}
              updateWhenIdle={true}
              updateWhenZooming={false}
              keepBuffer={3}
              detectRetina={false}
            />
            <ZoomControl position="bottomright" />
            <ScaleControl position="bottomright" />
            <MapEventsWrapper onMouseMove={handleMouseMove} onClick={handleMapClick} onMapReady={handleMapReady} onMoveEnd={handleMoveEnd} />
            <UserLocationMarker onLocationFound={handleLocationFound} showRadius={false} autoCenter={!flyToLocation} />

            {/* Disaster Alert Zones */}
            {showAlerts && activeAlerts.map(alert => (
              <Circle key={alert.id} center={[alert.lat, alert.lng]} radius={alert.radiusKm * 1000}
                pathOptions={{ fillColor: getSeverityColor(alert.severity), fillOpacity: 0.12, color: getSeverityColor(alert.severity), weight: 2, opacity: 0.6, dashArray: "6 4" }}>
                <Popup className="rounded-xl overflow-hidden shadow-xl p-0">
                  <div className="p-3 space-y-1.5 min-w-[200px]">
                    <h3 className="font-bold text-sm">{alert.title}</h3>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getSeverityColor(alert.severity) + "20", color: getSeverityColor(alert.severity) }}>
                        {alert.severity === "red" ? `🔴 ${t("map.high")}` : alert.severity === "orange" ? `🟠 ${t("map.moderate")}` : `🟡 ${t("map.advisory")}`}
                      </span>
                      <span className="text-muted-foreground">{alert.radiusKm}km</span>
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))}


            {/* ── Fishing Spots (scored, color-coded) ─────────── */}
            {showFishingSpots && fishingSpots.map((spot, i) => (
              <Circle
                key={`spot-${i}`}
                center={[spot.latitude, spot.longitude]}
                radius={500}
                pathOptions={{
                  fillColor: spot.color,
                  fillOpacity: 0.55,
                  color: spot.color,
                  weight: 2,
                  opacity: 0.9,
                }}
              >
                <Popup className="rounded-xl overflow-hidden shadow-xl p-0">
                  <div className="p-3 space-y-2.5 min-w-[240px]">
                    {/* Header: name + type */}
                    <div>
                      <h3 className="font-bold text-sm text-primary leading-tight">{spot.name}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{spot.type} • {spot.distance_km} {t("map.kmAway")}</p>
                    </div>

                    {/* Confidence score - large, prominent */}
                    <div className="rounded-lg p-2.5 border bg-background" style={{ borderColor: spot.color + '55' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t("map.overallConfidence")}</span>
                        <span className="text-xl font-extrabold" style={{ color: spot.color }}>{spot.confidence}<span className="text-xs font-normal text-muted-foreground">/100</span></span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden border border-black/5 dark:border-white/5 shadow-inner">
                        <div className="h-full rounded-full transition-all" style={{ width: `${spot.confidence}%`, background: spot.color }} />
                      </div>
                    </div>

                    {/* Fish Density - primary metric */}
                    <div className="rounded-lg p-2.5 border border-cyan-500/30 bg-cyan-500/5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide flex items-center gap-1">{t("map.fishDensity")}</span>
                        <span className="text-lg font-extrabold text-cyan-600 dark:text-cyan-400">{spot.fish_density_score}<span className="text-xs font-normal text-muted-foreground">/100</span></span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden border border-black/5 dark:border-white/5 shadow-inner">
                        <div className="h-full rounded-full bg-cyan-500 dark:bg-cyan-400 transition-all shadow-sm" style={{ width: `${spot.fish_density_score}%` }} />
                      </div>
                      {spot.chlorophyll_available && (
                        <p className="text-[9px] text-cyan-400 mt-1">{t("map.chlorophyllData")}</p>
                      )}
                      {spot.gemini_web_score !== null && spot.gemini_web_score !== undefined && (
                        <p className="text-[9px] text-violet-400 mt-0.5">{t("map.webSearch").replace("{score}", spot.gemini_web_score?.toString() || "0")}</p>
                      )}
                    </div>

                    {/* Secondary stats: Weather + Transport */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/50">
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground">{t("map.weatherTitle")}</p>
                        <p className="text-xs font-bold text-foreground">{spot.weather_score}<span className="text-[9px] font-normal text-muted-foreground">/100</span></p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground">{t("map.transport")}</p>
                        <p className="text-xs font-bold text-foreground">{spot.transport_score}<span className="text-[9px] font-normal text-muted-foreground">/100</span></p>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))}


            {/* Clicked Weather Pin */}
            {clickedWeather && (
              <Marker position={[clickedWeather.lat, clickedWeather.lng]}>
                <Popup className="rounded-xl overflow-hidden shadow-xl p-0">
                  <div className="p-3 space-y-2 min-w-[220px]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-primary flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t("map.weatherAtPoint")}</h3>
                      <button onClick={() => setClickedWeather(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{clickedWeather.lat.toFixed(4)}°N, {clickedWeather.lng.toFixed(4)}°E</p>
                    {clickedWeather.loading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="w-3 h-3 animate-spin" /> {t("map.fetchingWeather")}</div>
                    ) : (
                      <div className="space-y-1.5 pt-1 border-t border-border/50">
                        {clickedWeather.icon && (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`https://openweathermap.org/img/wn/${clickedWeather.icon}@2x.png`} alt="" className="w-8 h-8" />
                            <span className="text-xs capitalize text-foreground font-semibold">{clickedWeather.description}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <div className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-red-400" /><span className="text-muted-foreground">{t("map.temp")}</span><span className="font-bold text-foreground">{clickedWeather.temp?.toFixed(1)}°C</span></div>
                          <div className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-orange-400" /><span className="text-muted-foreground">{t("map.feels")}</span><span className="font-bold text-foreground">{clickedWeather.feelsLike?.toFixed(1)}°C</span></div>
                          <div className="flex items-center gap-1"><Wind className="w-3 h-3 text-blue-400" /><span className="text-muted-foreground">{t("map.wind")}</span><span className="font-bold text-foreground">{clickedWeather.wind} m/s</span></div>
                          <div className="flex items-center gap-1"><Droplets className="w-3 h-3 text-cyan-400" /><span className="text-muted-foreground">{t("map.humidity")}</span><span className="font-bold text-foreground">{clickedWeather.humidity}%</span></div>
                        </div>
                        {/* Ask AI about this location */}
                        <button
                          onClick={() => {
                            setMapPointContext({ lat: clickedWeather.lat, lon: clickedWeather.lng });
                            setContextPage('map');
                            const prompt = `Tell me about fishing conditions, weather forecast, and expected catch near coordinates ${clickedWeather.lat.toFixed(4)}°N, ${clickedWeather.lng.toFixed(4)}°E. Current weather: ${clickedWeather.description ?? 'unknown'}, temp ${clickedWeather.temp?.toFixed(1) ?? '?'}°C, wind ${clickedWeather.wind ?? '?'} m/s.`;
                            (window as any).__agentChatInject?.(
                              'Tell me about this location',
                              {
                                label: 'Tell me about this location',
                                detail: `${clickedWeather.lat.toFixed(4)}°N, ${clickedWeather.lng.toFixed(4)}°E`,
                                icon: 'map' as const,
                                backendText: prompt,
                              }
                            );
                          }}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-bold text-primary hover:text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />{t("map.askAIArea")}</button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {openWeatherLayer && (
              <TileLayer
                key={`owm-${activeLayer}`}
                attribution='&copy; OpenWeatherMap'
                url={openWeatherLayer}
                opacity={0.85}
                updateWhenIdle={true}
                updateWhenZooming={false}
                keepBuffer={2}
                detectRetina={false}
              />
            )}
          </MapContainer>
        )}

        {/* ── Floating UI ──────────────────────────────────────── */}
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-20 space-y-3 pointer-events-none max-w-[180px] sm:max-w-[240px]">
          <div className="flex flex-col gap-1.5 pointer-events-auto items-end">
            <Button size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl" onClick={handleFullscreen} title={t("map.fullscreen")}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl" onClick={handleLocateUser} title={t("map.myLocation")}>
              <Navigation className="w-4 h-4" />
            </Button>
            <Button size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl" onClick={handleResetView} title={t("map.resetView")}>
              <Crosshair className="w-4 h-4" />
            </Button>
            <Button size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl" onClick={() => setShowLegend(v => !v)} title={t("map.toggleLegend")}>
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Coordinate Tracker */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none hidden sm:block">
          <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] font-mono text-white flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span ref={coordsRef}>{mousePos.current.lat.toFixed(4)}°N, {mousePos.current.lng.toFixed(4)}°E</span>
          </div>
        </div>

        {/* ── Legend + Weather Scale ──────────────────────────── */}
        {showLegend && (
          <div className="absolute bottom-[84px] sm:bottom-4 left-3 sm:left-4 z-[1000] pointer-events-auto max-w-[380px]">
            <div className="flex flex-col gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/15 shadow-2xl">
              {/* <div className="flex items-center gap-3 sm:gap-5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Quality</span>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-white">
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Premium</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Standard</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{t("map.low")}</span>
                  </div>
                </div>

              </div> */}
              {showAlerts && activeAlerts.length > 0 && (
                <div className="flex items-center gap-2 pt-1.5 border-t border-white/10">
                  <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">{t("map.alerts")}</span>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-white">
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{t("map.high")}</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{t("map.mod")}</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{t("map.adv")}</span>
                  </div>
                </div>
              )}

              {/* Fishing Spots Legend */}
              {showFishingSpots && fishingSpots.length > 0 && (
                <div className={`${showAlerts && activeAlerts.length > 0 ? "pt-2 border-t border-white/10" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">{t("map.spots")}</span>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-white">
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t("map.good")}</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{t("map.fair")}</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{t("map.low")}</span>
                    </div>
                  </div>
                </div>
              )}
              {currentScale && (
                <div className="pt-1.5 border-t border-white/10">
                  <WeatherScaleLegend scale={currentScale} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/30 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs font-medium text-muted-foreground">{t("map.loading")}</p>
            </div>
          </div>
        )}



        <style>{`
          @keyframes fadeSlideDown {
            from { opacity: 0; transform: translate(-50%, -12px); }
            to   { opacity: 1; transform: translate(-50%, 0); }
          }
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
}
