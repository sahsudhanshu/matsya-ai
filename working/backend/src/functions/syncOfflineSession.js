/**
 * Lambda: POST /sync/offline-session
 *
 * Syncs a completed offline analysis session to MySQL (images and groups tables).
 *
 * Two-phase protocol:
 *   Phase 1 - POST /sync/offline-session/prepare
 *     Body:  { sessionType, files: [{fileName,fileType}], location? }
 *     Returns: { token, presignedUrls: [{uploadUrl, s3Key, index}] }
 *
 *   Phase 2 - POST /sync/offline-session/commit
 *     Body:  { token, localId/localGroupId, createdAt, detections,
 *               processingTime, location?, sessionType, … }
 *     Returns: { imageId | groupId, remoteId }
 */

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../utils/db");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const BUCKET = process.env.S3_BUCKET_NAME;
const URL_EXPIRY_SECONDS = 900; // 15 min

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildGroupAnalysisFromDetections(imageDetections) {
    const images = imageDetections.map((img) => {
        const crops = {};
        (img.detections || []).forEach((d, i) => {
            const cropS3Url = d.cropS3Key ? `https://${BUCKET}.s3.amazonaws.com/${d.cropS3Key}` : null;
            const gradcamS3Url = d.gradcamS3Key ? `https://${BUCKET}.s3.amazonaws.com/${d.gradcamS3Key}` : null;
            crops[`crop_${i}`] = {
                bbox: d.bbox,
                crop_url: cropS3Url,
                species: { label: d.species, confidence: d.speciesConfidence, gradcam_url: gradcamS3Url },
                disease: { label: d.disease, confidence: d.diseaseConfidence, gradcam_url: gradcamS3Url },
                yolo_confidence: d.speciesConfidence,
                measurements: { weight_g: d.weightG, length_mm: d.lengthMm, width_mm: Math.round(d.lengthMm * 0.3) },
                qualityGrade: d.qualityGrade,
                pricePerKg: d.pricePerKg,
                estimatedValue: d.estimatedValue,
                isLegalSize: d.isLegalSize,
                minLegalSize: d.minLegalSize,
            };
        });
        return { imageIndex: img.imageIndex, localImageId: img.localImageId || null, s3Key: img.s3Key || null, crops };
    });

    let totalFishCount = 0;
    const speciesDistribution = {};
    let totalConfidence = 0, confidenceCount = 0;
    let diseaseDetected = false, totalEstimatedWeight = 0, totalEstimatedValue = 0;

    for (const img of images) {
        const crops = Object.values(img.crops || {});
        totalFishCount += crops.length;
        for (const crop of crops) {
            const species = crop.species?.label || "Unknown";
            speciesDistribution[species] = (speciesDistribution[species] || 0) + 1;
            if (typeof crop.species?.confidence === "number") { totalConfidence += crop.species.confidence; confidenceCount++; }
            const disease = crop.disease?.label || "";
            if (disease.toLowerCase() !== "healthy" && disease.toLowerCase() !== "healthy fish") diseaseDetected = true;
            totalEstimatedWeight += (crop.measurements?.weight_g || 0) / 1000;
            totalEstimatedValue += crop.estimatedValue || 0;
        }
    }

    return {
        images,
        aggregateStats: {
            totalFishCount,
            speciesDistribution,
            averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
            diseaseDetected,
            totalEstimatedWeight: Math.round(totalEstimatedWeight * 100) / 100,
            totalEstimatedValue: Math.round(totalEstimatedValue),
        },
        processedAt: new Date().toISOString(),
        source: "offline",
    };
}

function buildSingleAnalysisResult(detections) {
    if (!detections || detections.length === 0) return null;
    const best = detections.reduce((b, d) => d.speciesConfidence > b.speciesConfidence ? d : b, detections[0]);
    const bestCropUrl = best.cropS3Key ? `https://${BUCKET}.s3.amazonaws.com/${best.cropS3Key}` : null;
    const bestGradcamUrl = best.gradcamS3Key ? `https://${BUCKET}.s3.amazonaws.com/${best.gradcamS3Key}` : null;
    return {
        species: best.species,
        confidence: best.speciesConfidence,
        qualityGrade: best.qualityGrade,
        isSustainable: best.disease === "Healthy Fish" && best.isLegalSize,
        measurements: { length_mm: best.lengthMm, weight_g: best.weightG, width_mm: Math.round(best.lengthMm * 0.3) },
        compliance: { is_legal_size: best.isLegalSize, min_legal_size_mm: best.minLegalSize },
        marketEstimate: { price_per_kg: best.pricePerKg, estimated_value: best.estimatedValue },
        weightEstimate: best.weightG / 1000,
        weightConfidence: best.speciesConfidence,
        marketPriceEstimate: best.pricePerKg,
        disease: best.disease,
        diseaseConfidence: best.diseaseConfidence,
        cropUrl: bestCropUrl,
        gradcamUrl: bestGradcamUrl,
        allDetections: detections.map(d => ({
            ...d,
            cropUrl: d.cropS3Key ? `https://${BUCKET}.s3.amazonaws.com/${d.cropS3Key}` : null,
            gradcamUrl: d.gradcamS3Key ? `https://${BUCKET}.s3.amazonaws.com/${d.gradcamS3Key}` : null,
        })),
        timestamp: new Date().toISOString(),
        source: "offline",
    };
}

// ── Phase 1: prepare ──────────────────────────────────────────────────────────

async function handlePrepare(event, userId) {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON body"); }

    const { sessionType, files } = body;

    if (!sessionType || !["single", "group"].includes(sessionType)) return badRequest("sessionType must be 'single' or 'group'");
    if (!Array.isArray(files) || files.length === 0) return badRequest("files array is required and must be non-empty");

    for (let i = 0; i < files.length; i++) {
        if (!files[i].fileName || !files[i].fileType) return badRequest(`files[${i}] must have fileName and fileType`);
        if (!ALLOWED_TYPES.includes(files[i].fileType)) return badRequest(`files[${i}].fileType must be one of: ${ALLOWED_TYPES.join(", ")}`);
    }

    const token = uuidv4();
    const groupId = uuidv4();

    try {
        const presignedUrls = await Promise.all(
            files.map(async (file, index) => {
                const ext = file.fileName.split(".").pop() || "jpg";
                const s3Key = files.length === 1 && sessionType === "single"
                    ? `uploads/${userId}/${groupId}.${ext}`
                    : `uploads/${userId}/${groupId}_${index}.${ext}`;
                const cmd = new PutObjectCommand({
                    Bucket: BUCKET,
                    Key: s3Key,
                    ContentType: file.fileType,
                    Metadata: { userId, sessionType, token, imageIndex: String(index) },
                });
                const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: URL_EXPIRY_SECONDS });
                return { uploadUrl, s3Key, index };
            })
        );
        return ok({ token, sessionId: groupId, sessionType, presignedUrls });
    } catch (err) {
        console.error("[syncOfflineSession/prepare] S3 error:", err);
        return serverError("Failed to generate upload URLs");
    }
}

// ── Phase 2: commit - write to MySQL ──────────────────────────────────────────

async function handleCommit(event, userId) {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON body"); }

    const {
        sessionType, sessionId, localId, localGroupId,
        createdAt, location, processingTime,
        detections, fishCount, avgConfidence, speciesDistribution, diseaseDetected,
        s3Key, images,
    } = body;

    if (!sessionType || !["single", "group"].includes(sessionType)) return badRequest("sessionType must be 'single' or 'group'");
    if (!createdAt) return badRequest("createdAt is required");

    const syncedAt = new Date().toISOString();
    const lat = location?.lat ?? null;
    const lng = location?.lng ?? null;

    if (sessionType === "single") {
        if (!localId) return badRequest("localId is required for single sessions");

        const imageId = sessionId || uuidv4();
        const analysisResult = buildSingleAnalysisResult(detections || []);

        try {
            await pool.execute(
                `INSERT INTO images (imageId, userId, source, s3Key, s3Path, latitude, longitude, locationMapped, status, analysisResult, createdAt, updatedAt)
                 VALUES (?, ?, 'offline', ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE updatedAt = VALUES(updatedAt)`,
                [
                    imageId, userId,
                    s3Key || null,
                    s3Key ? `s3://${BUCKET}/${s3Key}` : null,
                    lat, lng,
                    lat !== null && lng !== null ? 1 : 0,
                    analysisResult ? JSON.stringify(analysisResult) : null,
                    createdAt, syncedAt,
                ]
            );
        } catch (err) {
            console.error("[syncOfflineSession/commit/single] MySQL error:", err);
            return serverError("Failed to save offline image record");
        }
        return ok({ imageId, remoteId: imageId });

    } else {
        if (!Array.isArray(images) || images.length === 0) return badRequest("images array is required for group sessions");

        const groupId = sessionId || uuidv4();
        const s3Keys = images.map(img => img.s3Key).filter(Boolean);
        const analysisResult = buildGroupAnalysisFromDetections(images);

        try {
            await pool.execute(
                `INSERT INTO \`groups\` (groupId, userId, source, imageCount, s3Keys, latitude, longitude, locationMapped, status, analysisResult, createdAt, updatedAt)
                 VALUES (?, ?, 'offline', ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE updatedAt = VALUES(updatedAt)`,
                [
                    groupId, userId,
                    images.length,
                    JSON.stringify(s3Keys),
                    lat, lng,
                    lat !== null && lng !== null ? 1 : 0,
                    JSON.stringify(analysisResult),
                    createdAt, syncedAt,
                ]
            );
        } catch (err) {
            console.error("[syncOfflineSession/commit/group] MySQL error:", err);
            return serverError("Failed to save offline group record");
        }
        return ok({ groupId, remoteId: groupId });
    }
}

// ── Main handler ───────────────────────────────────────────────────────────────

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const action = event.pathParameters?.action;

    if (action === "prepare") return handlePrepare(event, userId);
    if (action === "commit") return handleCommit(event, userId);

    return badRequest("Unknown action. Use 'prepare' or 'commit'");
};
