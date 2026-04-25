/**
 * Real-time disaster alert system using OpenWeatherMap API.
 * Fetches live weather for Indian coastal monitoring stations and
 * generates alerts when conditions exceed safety thresholds.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertType = "cyclone" | "storm" | "heavy_rain" | "strong_wind" | "high_wave";
export type AlertSeverity = "red" | "orange" | "yellow";

export interface DisasterAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string;
    lat: number;
    lng: number;
    radiusKm: number;
    expiresAt: string; // ISO date
    source: string;    // data source attribution
}

// ── Coastal Monitoring Stations (lat/lng in the sea near Indian coast) ────────

interface MonitoringStation {
    id: string;
    name: string;
    region: string;
    lat: number;
    lng: number;
}

const MONITORING_STATIONS: MonitoringStation[] = [
    { id: "ms-mum", name: "Mumbai Offshore", region: "Maharashtra Coast", lat: 18.85, lng: 72.20 },
    { id: "ms-goa", name: "Goa Offshore", region: "Goa Coast", lat: 15.40, lng: 73.30 },
    { id: "ms-kch", name: "Kochi Offshore", region: "Kerala Coast", lat: 9.90, lng: 75.80 },
    { id: "ms-guj", name: "Porbandar Offshore", region: "Gujarat Coast", lat: 21.50, lng: 69.10 },
    { id: "ms-vis", name: "Visakhapatnam Offshore", region: "Andhra Coast", lat: 17.50, lng: 83.80 },
    { id: "ms-chn", name: "Chennai Offshore", region: "Tamil Nadu Coast", lat: 13.00, lng: 80.80 },
    { id: "ms-kol", name: "Kolkata Offshore", region: "West Bengal Coast", lat: 21.30, lng: 88.70 },
    { id: "ms-man", name: "Mangaluru Offshore", region: "Karnataka Coast", lat: 12.80, lng: 74.60 },
    { id: "ms-par", name: "Paradip Offshore", region: "Odisha Coast", lat: 20.20, lng: 87.10 },
    { id: "ms-kan", name: "Kanniyakumari", region: "Southern Tip", lat: 8.00, lng: 77.50 },
];

// ── Safety Thresholds ─────────────────────────────────────────────────────────

const THRESHOLDS = {
    wind: {
        advisory: 10,  // m/s (~36 km/h)
        moderate: 15,  // m/s (~54 km/h)
        high: 20,      // m/s (~72 km/h)
    },
    rain: {
        advisory: 5,   // mm/h (light heavy rain)
        moderate: 10,  // mm/h
        high: 25,      // mm/h (very heavy)
    },
    visibility: {
        advisory: 5000,  // meters
        moderate: 2000,
        high: 500,
    },
    gust: {
        advisory: 15,  // m/s
        moderate: 22,  // m/s
        high: 30,      // m/s
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
        case "red": return "#ef4444";
        case "orange": return "#f97316";
        case "yellow": return "#eab308";
    }
}

export function getSeverityBg(severity: AlertSeverity): string {
    switch (severity) {
        case "red": return "bg-red-500/15 border-red-500/30 text-red-400";
        case "orange": return "bg-orange-500/15 border-orange-500/30 text-orange-400";
        case "yellow": return "bg-yellow-500/15 border-yellow-500/30 text-yellow-400";
    }
}

export function getSeverityLabel(severity: AlertSeverity): string {
    switch (severity) {
        case "red": return "High";
        case "orange": return "Moderate";
        case "yellow": return "Advisory";
    }
}

export function getAlertIcon(type: AlertType): string {
    switch (type) {
        case "cyclone": return "🌀";
        case "storm": return "⛈️";
        case "heavy_rain": return "🌧️";
        case "strong_wind": return "💨";
        case "high_wave": return "🌊";
    }
}

export function isAlertExpired(alert: DisasterAlert): boolean {
    return new Date(alert.expiresAt).getTime() < Date.now();
}

export function getActiveAlerts(alerts: DisasterAlert[]): DisasterAlert[] {
    return alerts.filter((a) => !isAlertExpired(a));
}

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeSafetyStatus(
    userLat: number,
    userLng: number,
    alerts: DisasterAlert[]
): "SAFE" | "UNSAFE" {
    const active = getActiveAlerts(alerts);
    for (const alert of active) {
        const dist = haversineKm(userLat, userLng, alert.lat, alert.lng);
        if (dist <= alert.radiusKm) return "UNSAFE";
    }
    return "SAFE";
}

/** Returns time remaining until expiry as a human string */
export function timeUntilExpiry(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

// ── Real-time Alert Fetcher ──────────────────────────────────────────────────

function deriveAlertFromWeather(
    station: MonitoringStation,
    weather: any
): DisasterAlert | null {
    const wind = weather.wind?.speed ?? 0;      // m/s
    const gust = weather.wind?.gust ?? 0;       // m/s
    const rain1h = weather.rain?.["1h"] ?? 0;   // mm
    const visibility = weather.visibility ?? 10000; // meters
    const weatherId = weather.weather?.[0]?.id ?? 800; // OWM condition code
    const desc = weather.weather?.[0]?.description ?? "";
    const temp = weather.main?.temp ?? 25;

    const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

    // ── Thunderstorm / Cyclone (weather codes 200-232) ──────────────────
    if (weatherId >= 200 && weatherId <= 232) {
        const severity: AlertSeverity = wind >= THRESHOLDS.wind.high ? "red"
            : wind >= THRESHOLDS.wind.moderate ? "orange" : "yellow";
        const radiusKm = severity === "red" ? 200 : severity === "orange" ? 150 : 100;
        return {
            id: `live-${station.id}-storm`,
            type: wind >= THRESHOLDS.wind.high ? "cyclone" : "storm",
            severity,
            title: wind >= THRESHOLDS.wind.high
                ? `Severe Storm – ${station.region}`
                : `Thunderstorm Alert – ${station.region}`,
            description: `Active ${desc} near ${station.name}. Wind speed: ${(wind * 3.6).toFixed(0)} km/h${gust ? `, gusts up to ${(gust * 3.6).toFixed(0)} km/h` : ""}. Avoid open sea operations.`,
            lat: station.lat,
            lng: station.lng,
            radiusKm,
            expiresAt: hoursFromNow(6),
            source: "OpenWeatherMap – Live",
        };
    }

    // ── Strong Wind ─────────────────────────────────────────────────────
    if (wind >= THRESHOLDS.wind.advisory || gust >= THRESHOLDS.gust.advisory) {
        const severity: AlertSeverity = wind >= THRESHOLDS.wind.high || gust >= THRESHOLDS.gust.high ? "red"
            : wind >= THRESHOLDS.wind.moderate || gust >= THRESHOLDS.gust.moderate ? "orange" : "yellow";
        const radiusKm = severity === "red" ? 180 : severity === "orange" ? 120 : 80;
        return {
            id: `live-${station.id}-wind`,
            type: "strong_wind",
            severity,
            title: `${severity === "red" ? "Severe" : severity === "orange" ? "Strong" : ""} Wind Warning – ${station.region}`,
            description: `Wind speed: ${(wind * 3.6).toFixed(0)} km/h${gust ? `, gusts: ${(gust * 3.6).toFixed(0)} km/h` : ""} at ${station.name}. ${severity === "red" ? "All vessels must return to port." : severity === "orange" ? "Small craft advisory in effect." : "Exercise caution at sea."}`,
            lat: station.lat,
            lng: station.lng,
            radiusKm,
            expiresAt: hoursFromNow(4),
            source: "OpenWeatherMap – Live",
        };
    }

    // ── Heavy Rain (weather codes 500-531 or measured rain) ─────────────
    if (rain1h >= THRESHOLDS.rain.advisory || (weatherId >= 502 && weatherId <= 531)) {
        const severity: AlertSeverity = rain1h >= THRESHOLDS.rain.high || weatherId >= 520 ? "red"
            : rain1h >= THRESHOLDS.rain.moderate || weatherId >= 502 ? "orange" : "yellow";
        return {
            id: `live-${station.id}-rain`,
            type: "heavy_rain",
            severity,
            title: `Heavy Rainfall – ${station.region}`,
            description: `${rain1h > 0 ? `Rainfall intensity: ${rain1h.toFixed(1)} mm/h` : `Heavy precipitation`} reported near ${station.name}. ${severity === "red" ? "Flooding possible in coastal areas." : "Reduced visibility at sea."}`,
            lat: station.lat,
            lng: station.lng,
            radiusKm: severity === "red" ? 150 : 100,
            expiresAt: hoursFromNow(3),
            source: "OpenWeatherMap – Live",
        };
    }

    // ── Poor Visibility ─────────────────────────────────────────────────
    if (visibility <= THRESHOLDS.visibility.advisory) {
        const severity: AlertSeverity = visibility <= THRESHOLDS.visibility.high ? "red"
            : visibility <= THRESHOLDS.visibility.moderate ? "orange" : "yellow";
        return {
            id: `live-${station.id}-vis`,
            type: "high_wave",
            severity,
            title: `Low Visibility Warning – ${station.region}`,
            description: `Visibility: ${(visibility / 1000).toFixed(1)} km at ${station.name}. ${severity === "red" ? "Navigation extremely hazardous." : "Proceed with extreme caution."}`,
            lat: station.lat,
            lng: station.lng,
            radiusKm: 80,
            expiresAt: hoursFromNow(3),
            source: "OpenWeatherMap – Live",
        };
    }

    return null;
}

/** Cache to avoid re-fetching within 5 minutes */
let _alertCache: { alerts: DisasterAlert[]; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch real-time weather alerts for Indian coastal waters.
 * Uses OpenWeatherMap current weather endpoint for 10 monitoring stations.
 * Derives alerts from actual conditions using safety thresholds.
 */
export async function fetchLiveAlerts(apiKey: string): Promise<DisasterAlert[]> {
    // Return cache if fresh
    if (_alertCache && (Date.now() - _alertCache.fetchedAt) < CACHE_TTL) {
        return _alertCache.alerts;
    }

    if (!apiKey) return [];

    try {
        const results = await Promise.allSettled(
            MONITORING_STATIONS.map(async (station) => {
                const res = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?lat=${station.lat}&lon=${station.lng}&appid=${apiKey}&units=metric`,
                    { next: { revalidate: 300 } } // Next.js ISR: cache for 5 min
                );
                if (!res.ok) return null;
                const data = await res.json();
                return deriveAlertFromWeather(station, data);
            })
        );

        const alerts = results
            .filter((r): r is PromiseFulfilledResult<DisasterAlert | null> => r.status === "fulfilled")
            .map((r) => r.value)
            .filter((a): a is DisasterAlert => a !== null);

        // Deduplicate: keep highest severity per station
        const deduped = new Map<string, DisasterAlert>();
        const severityOrder: Record<AlertSeverity, number> = { red: 0, orange: 1, yellow: 2 };
        for (const alert of alerts) {
            const existing = deduped.get(alert.id);
            if (!existing || severityOrder[alert.severity] < severityOrder[existing.severity]) {
                deduped.set(alert.id, alert);
            }
        }

        const finalAlerts = Array.from(deduped.values());
        _alertCache = { alerts: finalAlerts, fetchedAt: Date.now() };
        return finalAlerts;
    } catch (err) {
        console.error("Failed to fetch live alerts:", err);
        return _alertCache?.alerts ?? [];
    }
}
