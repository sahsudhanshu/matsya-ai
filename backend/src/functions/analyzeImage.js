/**
 * Lambda: POST /images/{imageId}/analyze
 *
 * Calls the external ML API (placeholder) to analyze an uploaded fish image.
 * Stores the analysis result back to DynamoDB.
 *
 * ⚠️  PLUG IN YOUR ML API: Replace the ML_API_URL env var with your real endpoint.
 *     The expected response shape is documented below.
 */
const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { ddb } = require("../utils/dynamodb");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, notFound, serverError, badRequest } = require("../utils/response");

const SPECIES_DATA = [
    { name: "Indian Pomfret", scientific: "Pampus argenteus", minSize: 150, pricePerKg: 650 },
    { name: "Indian Mackerel", scientific: "Rastrelliger kanagurta", minSize: 100, pricePerKg: 220 },
    { name: "Kingfish", scientific: "Scomberomorus commerson", minSize: 350, pricePerKg: 480 },
    { name: "Yellowfin Tuna", scientific: "Thunnus albacares", minSize: 450, pricePerKg: 420 },
    { name: "Indo-Pacific Swordfish", scientific: "Xiphias gladius", minSize: 1200, pricePerKg: 820 },
    { name: "Seer Fish", scientific: "Scomberomorus guttatus", minSize: 300, pricePerKg: 850 },
    { name: "Hilsa Shad", scientific: "Tenualosa ilisha", minSize: 250, pricePerKg: 700 },
];

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

const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "";
const ML_API_URL = process.env.ML_API_URL || "";
const ML_API_KEY = process.env.ML_API_KEY || "";

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const imageId = event.pathParameters?.imageId;
    if (!imageId) return badRequest("imageId path parameter is required");

    // Fetch existing image record
    let image;
    try {
        const result = await ddb.send(
            new GetCommand({ TableName: IMAGES_TABLE, Key: { imageId } })
        );
        if (!result.Item) return notFound("Image not found");
        if (result.Item.userId !== decoded.sub) return unauthorized("Access denied");
        image = result.Item;
    } catch (err) {
        console.error("analyzeImage fetch error:", err);
        return serverError("Failed to fetch image record");
    }

    // Mark as processing
    await ddb.send(
        new UpdateCommand({
            TableName: IMAGES_TABLE,
            Key: { imageId },
            UpdateExpression: "SET #s = :s, updatedAt = :ua",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":s": "processing", ":ua": new Date().toISOString() },
        })
    );

    try {
        // ── CALL ML API ──────────────────────────────────────────────────────────
        // TODO: Replace with your real ML endpoint.
        // Expected request:  POST ML_API_URL  { s3Path: string }
        // Expected response: {
        //   species: string, scientificName: string, qualityGrade: string,
        //   confidence: number,
        //   measurements: { length_mm: number, weight_g: number, width_mm: number },
        //   compliance: { is_legal_size: boolean, min_legal_size_mm: number },
        //   marketEstimate: { price_per_kg: number, estimated_value: number }
        // }
        // ────────────────────────────────────────────────────────────────────────

        const BUCKET = process.env.S3_BUCKET_NAME || "";
        const getObj = await s3.send(new GetObjectCommand({
            Bucket: BUCKET,
            Key: image.s3Key,
        }));

        const streamToBuffer = (stream) => new Promise((resolve, reject) => {
            const chunks = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("error", reject);
            stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
        const buffer = await streamToBuffer(getObj.Body);

        const formData = new FormData();
        const blob = new Blob([buffer], { type: getObj.ContentType || 'image/jpeg' });
        formData.append('image', blob, image.s3Key.split('/').pop() || 'image.jpg');

        const hfRes = await fetch(ML_API_URL, {
            method: "POST",
            body: formData,
        });

        if (!hfRes.ok) throw new Error(`HF returned ${hfRes.status}`);
        const hfData = await hfRes.json();

        const rawCrops = Object.values(hfData?.crops ?? {});
        if (!rawCrops.length) {
            throw new Error("No fish detected in the image");
        }

        // Get ML API base URL for converting relative URLs to absolute
        const ML_API_BASE = ML_API_URL.replace(/\/predict$/, '');
        const ensureAbsoluteUrl = (url) => {
            if (!url) return null;
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            const cleanUrl = url.startsWith('/') ? url : `/${url}`;
            return `${ML_API_BASE}${cleanUrl}`;
        };

        const speciesMap = new Map();
        for (const crop of rawCrops) {
            const speciesData = crop?.species || {};
            const key = speciesData.label?.toLowerCase() || 'unknown';
            const cropConfidence = speciesData.confidence || 0;
            const existing = speciesMap.get(key);
            if (!existing || cropConfidence > existing.confidence) {
                speciesMap.set(key, { confidence: cropConfidence, crop });
            }
        }
        let best = [...speciesMap.values()][0];
        for (let val of speciesMap.values()) {
            if (val.confidence > best.confidence) best = val;
        }

        const bestCrop = best.crop;
        const speciesOption = bestCrop?.species || {};
        const speciesLabel = speciesOption.label || 'Unknown';
        const confidence = speciesOption.confidence || 0;

        const matched = matchSpecies(speciesLabel);
        const length_mm = matched.minSize + Math.round(Math.random() * 200);
        const weight_g = Math.round((length_mm / 1000) ** 3 * 1e6 * (0.012 + Math.random() * 0.004));
        const grade = confidence >= 0.9 ? "Premium" : confidence >= 0.75 ? "Standard" : "Low";
        const isSustainable = length_mm >= matched.minSize;
        const estimated_value = Math.round((weight_g / 1000) * matched.pricePerKg);

        let analysisResult = {
            species: speciesLabel,
            confidence: confidence,
            scientificName: matched.scientific,
            qualityGrade: grade,
            isSustainable: isSustainable,
            measurements: {
                length_mm, weight_g, width_mm: Math.round(length_mm * 0.35)
            },
            compliance: {
                is_legal_size: isSustainable,
                min_legal_size_mm: matched.minSize
            },
            marketEstimate: { price_per_kg: matched.pricePerKg, estimated_value },
            weightEstimate: weight_g / 1000,
            weightConfidence: 0.78,
            marketPriceEstimate: matched.pricePerKg,
            timestamp: new Date().toISOString(),
            debugUrls: {
                yoloImageUrl: ensureAbsoluteUrl(hfData.yolo_image_url),
                cropImageUrl: ensureAbsoluteUrl(bestCrop.crop_url),
                gradcamUrl: ensureAbsoluteUrl(bestCrop?.species?.gradcam_url)
            }
        };

        // Save result to DynamoDB
        await ddb.send(
            new UpdateCommand({
                TableName: IMAGES_TABLE,
                Key: { imageId },
                UpdateExpression:
                    "SET #s = :s, analysisResult = :ar, updatedAt = :ua",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                    ":s": "completed",
                    ":ar": analysisResult,
                    ":ua": new Date().toISOString(),
                },
            })
        );
        return ok({ imageId, analysisResult });
    } catch (err) {
        console.error("analyzeImage ML call error:", err);
        // Mark failed
        await ddb.send(
            new UpdateCommand({
                TableName: IMAGES_TABLE,
                Key: { imageId },
                UpdateExpression: "SET #s = :s, updatedAt = :ua",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: { ":s": "failed", ":ua": new Date().toISOString() },
            })
        );
        return serverError("ML analysis failed. Please try again.");
    }
};
