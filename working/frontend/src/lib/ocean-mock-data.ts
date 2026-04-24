/**
 * Realistic dummy ocean catch data - points placed IN THE SEA along
 * the Indian western coast & Bay of Bengal.
 * Each record simulates a fisherman's catch upload with GPS from a boat.
 */

export interface OceanCatchPoint {
    id: string;
    latitude: number;
    longitude: number;
    species: string;
    weight_kg: number;
    qualityGrade: "Premium" | "Standard" | "Low";
    freshness: "Excellent" | "Good" | "Fair";
    waterTemp: number; // °C
    depth_m: number;
    catchMethod: string;
    timestamp: string; // ISO
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

export const OCEAN_CATCH_DATA: OceanCatchPoint[] = [
    // ── Arabian Sea - Konkan Coast ──────────────────────────────
    {
        id: "oc-1",
        latitude: 16.85,
        longitude: 72.45,
        species: "Pomfret",
        weight_kg: 2.4,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 27.3,
        depth_m: 35,
        catchMethod: "Gill Net",
        timestamp: hoursAgo(2),
    },
    {
        id: "oc-2",
        latitude: 17.22,
        longitude: 72.10,
        species: "Mackerel",
        weight_kg: 1.8,
        qualityGrade: "Standard",
        freshness: "Good",
        waterTemp: 26.8,
        depth_m: 20,
        catchMethod: "Purse Seine",
        timestamp: hoursAgo(5),
    },
    {
        id: "oc-3",
        latitude: 15.65,
        longitude: 72.90,
        species: "Sardine",
        weight_kg: 0.6,
        qualityGrade: "Standard",
        freshness: "Good",
        waterTemp: 28.1,
        depth_m: 15,
        catchMethod: "Ring Seine",
        timestamp: hoursAgo(8),
    },
    // ── Arabian Sea - Goa / South ──────────────────────────────
    {
        id: "oc-4",
        latitude: 15.30,
        longitude: 73.50,
        species: "Kingfish",
        weight_kg: 5.2,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 27.9,
        depth_m: 50,
        catchMethod: "Troll Line",
        timestamp: hoursAgo(1),
    },
    {
        id: "oc-5",
        latitude: 14.80,
        longitude: 73.20,
        species: "Tuna",
        weight_kg: 8.5,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 26.5,
        depth_m: 80,
        catchMethod: "Long Line",
        timestamp: hoursAgo(3),
    },
    // ── Arabian Sea - Kerala / Lakshadweep ─────────────────────
    {
        id: "oc-6",
        latitude: 10.60,
        longitude: 74.80,
        species: "Prawn",
        weight_kg: 1.2,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 29.0,
        depth_m: 12,
        catchMethod: "Trawl Net",
        timestamp: hoursAgo(4),
    },
    {
        id: "oc-7",
        latitude: 11.50,
        longitude: 72.00,
        species: "Skipjack Tuna",
        weight_kg: 6.0,
        qualityGrade: "Standard",
        freshness: "Good",
        waterTemp: 28.5,
        depth_m: 100,
        catchMethod: "Pole & Line",
        timestamp: hoursAgo(12),
    },
    // ── Arabian Sea - Gujarat Coast ────────────────────────────
    {
        id: "oc-8",
        latitude: 20.70,
        longitude: 69.20,
        species: "Hilsa",
        weight_kg: 1.0,
        qualityGrade: "Standard",
        freshness: "Fair",
        waterTemp: 25.2,
        depth_m: 18,
        catchMethod: "Gill Net",
        timestamp: hoursAgo(18),
    },
    {
        id: "oc-9",
        latitude: 21.50,
        longitude: 68.80,
        species: "Ribbon Fish",
        weight_kg: 0.9,
        qualityGrade: "Low",
        freshness: "Fair",
        waterTemp: 24.8,
        depth_m: 25,
        catchMethod: "Trawl Net",
        timestamp: hoursAgo(22),
    },
    // ── Bay of Bengal - Tamil Nadu ──────────────────────────────
    {
        id: "oc-10",
        latitude: 12.00,
        longitude: 81.50,
        species: "Seer Fish",
        weight_kg: 4.3,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 28.7,
        depth_m: 40,
        catchMethod: "Gill Net",
        timestamp: hoursAgo(6),
    },
    {
        id: "oc-11",
        latitude: 10.50,
        longitude: 80.80,
        species: "Crab",
        weight_kg: 0.5,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 29.2,
        depth_m: 8,
        catchMethod: "Crab Trap",
        timestamp: hoursAgo(3),
    },
    // ── Bay of Bengal - Andhra / Odisha ─────────────────────────
    {
        id: "oc-12",
        latitude: 16.50,
        longitude: 82.80,
        species: "Pomfret",
        weight_kg: 3.1,
        qualityGrade: "Standard",
        freshness: "Good",
        waterTemp: 27.4,
        depth_m: 30,
        catchMethod: "Gill Net",
        timestamp: hoursAgo(10),
    },
    {
        id: "oc-13",
        latitude: 19.80,
        longitude: 86.50,
        species: "Shrimp",
        weight_kg: 0.8,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 26.9,
        depth_m: 10,
        catchMethod: "Trawl Net",
        timestamp: hoursAgo(7),
    },
    // ── Deep Sea entries ───────────────────────────────────────
    {
        id: "oc-14",
        latitude: 13.50,
        longitude: 70.00,
        species: "Yellowfin Tuna",
        weight_kg: 12.0,
        qualityGrade: "Premium",
        freshness: "Excellent",
        waterTemp: 25.5,
        depth_m: 150,
        catchMethod: "Long Line",
        timestamp: hoursAgo(14),
    },
    {
        id: "oc-15",
        latitude: 8.50,
        longitude: 76.20,
        species: "Squid",
        weight_kg: 0.4,
        qualityGrade: "Standard",
        freshness: "Good",
        waterTemp: 28.3,
        depth_m: 45,
        catchMethod: "Jig Line",
        timestamp: hoursAgo(9),
    },
];

// ── Zone Insight summaries ────────────────────────────────────────────────────

export interface ZoneInsight {
    zone: string;
    region: string;
    topSpecies: string[];
    avgTemp: number;
    catchCount: number;
    trend: "up" | "down" | "stable";
    healthStatus: "Healthy" | "Moderate" | "Stressed";
    advisory: string;
}

export const ZONE_INSIGHTS: ZoneInsight[] = [
    {
        zone: "Arabian Sea - Konkan",
        region: "15°N – 18°N, 72°E – 73°E",
        topSpecies: ["Pomfret", "Mackerel", "Sardine"],
        avgTemp: 27.4,
        catchCount: 3,
        trend: "up",
        healthStatus: "Healthy",
        advisory: "Good conditions for gill net fishing. Sardine schools spotted near Ratnagiri.",
    },
    {
        zone: "Arabian Sea - Goa Deep",
        region: "14°N – 16°N, 73°E – 74°E",
        topSpecies: ["Kingfish", "Tuna", "Seer Fish"],
        avgTemp: 27.2,
        catchCount: 2,
        trend: "up",
        healthStatus: "Healthy",
        advisory: "Tuna migration active. Optimal window: next 8 hours.",
    },
    {
        zone: "Bay of Bengal - East Coast",
        region: "10°N – 17°N, 80°E – 83°E",
        topSpecies: ["Seer Fish", "Pomfret", "Crab"],
        avgTemp: 28.4,
        catchCount: 4,
        trend: "stable",
        healthStatus: "Moderate",
        advisory: "Moderate currents. Avoid deep sea operations near storm zone.",
    },
    {
        zone: "Lakshadweep Sea",
        region: "10°N – 13°N, 70°E – 73°E",
        topSpecies: ["Skipjack Tuna", "Yellowfin Tuna"],
        avgTemp: 27.0,
        catchCount: 2,
        trend: "up",
        healthStatus: "Healthy",
        advisory: "Premium tuna catches reported. Long line recommended.",
    },
];
