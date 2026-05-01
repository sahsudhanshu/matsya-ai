/**
 * Shared type definitions for ML analysis responses and helper utilities.
 * Used by api-client.ts, upload pages, and history components.
 */

// ── ML API Response Types (YOLO + Species + Disease model) ─────────────────

export interface MLPrediction {
    label: string;
    confidence: number;
    gradcam_url: string;
}

export interface MLCropResult {
    bbox: number[];
    crop_url: string;
    species: MLPrediction;
    disease: MLPrediction;
    yolo_confidence: number;
}

export interface MLAnalysisResponse {
    crops: Record<string, MLCropResult>;
    yolo_image_url: string;
}

/** Supplementary data per crop (fields not provided by ML API) */
export interface MockCropSupplement {
    scientificName: string;
    qualityGrade: "Premium" | "Standard" | "Low";
    isSustainable: boolean;
    weight_kg: number;
    length_mm: number;
    marketPricePerKg: number;
    estimatedValue: number;
}

// ── Group Analysis Types ──────────────────────────────────────────────────────

export interface GroupAnalysis {
    images: Array<{
        imageIndex: number;
        s3Key: string;
        crops: Record<string, MLCropResult>;
        yolo_image_url: string;
        error?: string;
    }>;
    aggregateStats: {
        totalFishCount: number;
        speciesDistribution: Record<string, number>;
        averageConfidence: number;
        diseaseDetected: boolean;
        totalEstimatedWeight: number;
        totalEstimatedValue: number;
    };
    processedAt: string;
}

// ── Species Reference Data ───────────────────────────────────────────────────

export const SPECIES_DATA: { name: string; scientific: string; minSize: number; pricePerKg: number }[] = [
    { name: "Indian Pomfret", scientific: "Pampus argenteus", minSize: 150, pricePerKg: 650 },
    { name: "Indian Mackerel", scientific: "Rastrelliger kanagurta", minSize: 100, pricePerKg: 220 },
    { name: "Kingfish", scientific: "Scomberomorus commerson", minSize: 350, pricePerKg: 480 },
    { name: "Yellowfin Tuna", scientific: "Thunnus albacares", minSize: 450, pricePerKg: 420 },
    { name: "Indo-Pacific Swordfish", scientific: "Xiphias gladius", minSize: 1200, pricePerKg: 820 },
    { name: "Seer Fish", scientific: "Scomberomorus guttatus", minSize: 300, pricePerKg: 850 },
    { name: "Hilsa Shad", scientific: "Tenualosa ilisha", minSize: 250, pricePerKg: 700 },
    { name: "Pangasius", scientific: "Pangasianodon hypophthalmus", minSize: 200, pricePerKg: 180 },
    { name: "Rohu", scientific: "Labeo rohita", minSize: 250, pricePerKg: 200 },
    { name: "Catla", scientific: "Catla catla", minSize: 300, pricePerKg: 220 },
    { name: "Tilapia", scientific: "Oreochromis niloticus", minSize: 150, pricePerKg: 160 },
    { name: "Sardine", scientific: "Sardinella longiceps", minSize: 80, pricePerKg: 120 },
    { name: "Barramundi", scientific: "Lates calcarifer", minSize: 300, pricePerKg: 450 },
];

const DISEASES = ["Healthy", "White Tail Disease", "Epizootic Ulcerative Syndrome", "Bacterial Gill Disease", "Fin Rot"];
const GRADES: ("Premium" | "Standard" | "Low")[] = ["Premium", "Standard", "Low"];

// ── Supplement Generator ─────────────────────────────────────────────────────

/** Deterministic pseudo-random based on string hash */
function seededRandom(seed: number): number {
    return ((seed * 9301 + 49297) % 233280) / 233280;
}

/** Generate supplementary data for a crop (deterministic by species + index) */
export function generateMockSupplement(speciesLabel: string, cropIndex: number = 0): MockCropSupplement {
    const match = SPECIES_DATA.find(s =>
        s.name.toLowerCase() === speciesLabel.toLowerCase() ||
        s.name.toLowerCase().includes(speciesLabel.toLowerCase()) ||
        speciesLabel.toLowerCase().includes(s.name.toLowerCase())
    );
    const data = match || { name: speciesLabel, scientific: `${speciesLabel} sp.`, minSize: 150, pricePerKg: 300 };

    return {
        scientificName: data.scientific,
        qualityGrade: "Standard",
        isSustainable: false,
        weight_kg: 0,
        length_mm: 0,
        marketPricePerKg: data.pricePerKg,
        estimatedValue: 0,
    };
}
