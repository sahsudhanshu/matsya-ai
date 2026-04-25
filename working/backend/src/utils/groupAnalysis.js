/**
 * Group Analysis Combination Logic
 * 
 * Provides functions to:
 * - Combine individual ML API responses into Group_Analysis
 * - Calculate aggregate statistics across all images
 * - Generate mock supplement data for weight and value estimation
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.9
 */

/**
 * Species data for weight and value estimation
 * Matches the data from analyzeImage.js for consistency
 */
const SPECIES_DATA = [
    { name: "Indian Pomfret", scientific: "Pampus argenteus", minSize: 150, pricePerKg: 650 },
    { name: "Indian Mackerel", scientific: "Rastrelliger kanagurta", minSize: 100, pricePerKg: 220 },
    { name: "Kingfish", scientific: "Scomberomorus commerson", minSize: 350, pricePerKg: 480 },
    { name: "Yellowfin Tuna", scientific: "Thunnus albacares", minSize: 450, pricePerKg: 420 },
    { name: "Indo-Pacific Swordfish", scientific: "Xiphias gladius", minSize: 1200, pricePerKg: 820 },
    { name: "Seer Fish", scientific: "Scomberomorus guttatus", minSize: 300, pricePerKg: 850 },
    { name: "Hilsa Shad", scientific: "Tenualosa ilisha", minSize: 250, pricePerKg: 700 },
];

/**
 * Match species label to species data
 * 
 * @param {string} label - Species label from ML API
 * @returns {Object} Matched species data
 */
function matchSpecies(label) {
    if (!label) return SPECIES_DATA[0];
    const lower = label.toLowerCase();
    return (
        SPECIES_DATA.find(
            (s) =>
                lower.includes(s.name.split(" ")[0].toLowerCase()) ||
                s.name.toLowerCase().includes(lower)
        ) ?? SPECIES_DATA[0]
    );
}

/**
 * Generate mock supplement data for a fish crop
 * Calculates estimated weight and value based on species
 * 
 * @param {string} speciesLabel - Species label from ML API
 * @returns {Object} Supplement data with weight_kg and estimatedValue
 */
function generateMockSupplement(speciesLabel) {
    const matched = matchSpecies(speciesLabel);
    const length_mm = matched.minSize + Math.round(Math.random() * 200);
    const weight_g = Math.round((length_mm / 1000) ** 3 * 1e6 * (0.012 + Math.random() * 0.004));
    const weight_kg = weight_g / 1000;
    const estimatedValue = Math.round(weight_kg * matched.pricePerKg);

    return {
        weight_kg,
        estimatedValue,
    };
}

/**
 * Calculate aggregate statistics from all image analysis results
 * 
 * @param {Array} images - Array of ImageAnalysis objects
 * @returns {Object} AggregateStats object
 * 
 * Validates: Requirements 4.6
 */
function calculateAggregateStats(images) {
    let totalFishCount = 0;
    const speciesDistribution = {};
    let totalConfidence = 0;
    let confidenceCount = 0;
    let diseaseDetected = false;
    let totalEstimatedWeight = 0;
    let totalEstimatedValue = 0;

    for (const image of images) {
        // Skip images with errors
        if (image.error) continue;

        // Get all crops for this image
        const crops = Object.values(image.crops || {});
        totalFishCount += crops.length;

        for (const crop of crops) {
            // Species distribution
            const species = crop.species?.label || "Unknown";
            speciesDistribution[species] = (speciesDistribution[species] || 0) + 1;

            // Average confidence
            if (crop.species?.confidence !== undefined) {
                totalConfidence += crop.species.confidence;
                confidenceCount++;
            }

            // Disease detection (any non-healthy disease label)
            const diseaseLabel = crop.disease?.label || "";
            if (diseaseLabel.toLowerCase() !== "healthy" && diseaseLabel.toLowerCase() !== "healthy fish") {
                diseaseDetected = true;
            }

            // Weight and value estimation using mock supplement logic
            const supplement = generateMockSupplement(species);
            totalEstimatedWeight += supplement.weight_kg;
            totalEstimatedValue += supplement.estimatedValue;
        }
    }

    return {
        totalFishCount,
        speciesDistribution,
        averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        diseaseDetected,
        totalEstimatedWeight: Math.round(totalEstimatedWeight * 100) / 100, // Round to 2 decimals
        totalEstimatedValue: Math.round(totalEstimatedValue),
    };
}

/**
 * Convert relative ML API URLs to absolute URLs
 * 
 * @param {string} url - URL to convert (may be relative or absolute)
 * @param {string} mlApiBaseUrl - Base URL of the ML API
 * @returns {string} Absolute URL
 */
function ensureAbsoluteUrl(url, mlApiBaseUrl) {
    if (!url) return url;

    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // Relative URL - convert to absolute using ML API base URL
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${mlApiBaseUrl}${cleanUrl}`;
}

/**
 * Combine individual ML API responses into Group_Analysis
 * 
 * @param {Array} mlResults - Array of ML API results from processImagesAsync
 * @returns {Object} GroupAnalysis object
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.9
 */
function combineMLResponses(mlResults) {
    // Get ML API base URL from environment
    const ML_API_URL = process.env.ML_API_URL || "";
    const ML_API_BASE = ML_API_URL.replace(/\/predict$/, ''); // Remove /predict endpoint

    // Map each ML response to ImageAnalysis format
    const images = mlResults.map((result) => {
        // Convert all relative URLs to absolute URLs pointing to ML API
        const crops = {};
        if (result.crops) {
            for (const [cropKey, crop] of Object.entries(result.crops)) {
                crops[cropKey] = {
                    ...crop,
                    crop_url: ensureAbsoluteUrl(crop.crop_url, ML_API_BASE),
                    species: crop.species ? {
                        ...crop.species,
                        gradcam_url: ensureAbsoluteUrl(crop.species.gradcam_url, ML_API_BASE),
                    } : crop.species,
                    disease: crop.disease ? {
                        ...crop.disease,
                        gradcam_url: ensureAbsoluteUrl(crop.disease.gradcam_url, ML_API_BASE),
                    } : crop.disease,
                };
            }
        }

        const imageAnalysis = {
            imageIndex: result.imageIndex,
            s3Key: result.s3Key,
            crops,
            yolo_image_url: ensureAbsoluteUrl(result.yolo_image_url, ML_API_BASE),
        };

        // Add error information if present
        if (result.error) {
            imageAnalysis.error = result.error;
        }

        return imageAnalysis;
    });

    // Calculate aggregate statistics
    const aggregateStats = calculateAggregateStats(images);

    // Return complete Group_Analysis
    return {
        images,
        aggregateStats,
        processedAt: new Date().toISOString(),
    };
}

module.exports = {
    combineMLResponses,
    calculateAggregateStats,
    generateMockSupplement,
};
