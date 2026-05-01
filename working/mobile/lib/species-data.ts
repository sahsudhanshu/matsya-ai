/**
 * Species reference data and supplement generator for mobile app.
 * Matches frontend/src/lib/types.ts logic.
 */

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

const GRADES: ("Premium" | "Standard" | "Low")[] = ["Premium", "Standard", "Low"];

/** Deterministic pseudo-random based on string hash */
function seededRandom(seed: number): number {
    return ((seed * 9301 + 49297) % 233280) / 233280;
}

export interface MockCropSupplement {
    scientificName: string;
    qualityGrade: "Premium" | "Standard" | "Low";
    isSustainable: boolean;
    weight_kg: number;
    length_mm: number;
    marketPricePerKg: number;
    estimatedValue: number;
}

/** Generate supplementary data for a crop (deterministic by species + index) */
export function generateMockSupplement(speciesLabel: string, cropIndex: number = 0): MockCropSupplement {
    const match = SPECIES_DATA.find(s =>
        s.name.toLowerCase() === speciesLabel.toLowerCase() ||
        s.name.toLowerCase().includes(speciesLabel.toLowerCase()) ||
        speciesLabel.toLowerCase().includes(s.name.toLowerCase())
    );
    const data = match || { name: speciesLabel, scientific: `${speciesLabel} sp.`, minSize: 150, pricePerKg: 300 };

    const hash = speciesLabel.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + cropIndex * 137;
    const r1 = seededRandom(hash);
    const r2 = seededRandom(hash + 31);
    const r3 = seededRandom(hash + 67);

    const length_mm = 0;
    const weight_g = 0;
    const grade = "Standard";

    return {
        scientificName: data.scientific,
        qualityGrade: grade,
        isSustainable: false,
        weight_kg: 0,
        length_mm: 0,
        marketPricePerKg: data.pricePerKg,
        estimatedValue: 0,
    };
}
