/**
 * Lambda: POST /offline-analyses
 *
 * Persists an offline (on-device) fish analysis record to MySQL.
 * Called by the mobile app when connectivity is restored after an offline scan.
 */
const { pool } = require("../utils/db");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch {
        return badRequest("Invalid JSON body");
    }

    const {
        localId, createdAt, imageUri, location,
        processingTime, fishCount, avgConfidence,
        speciesDistribution, diseaseDetected, detections,
    } = body;

    if (!localId || !createdAt || fishCount === undefined) {
        return badRequest("Missing required fields: localId, createdAt, fishCount");
    }

    if (typeof fishCount !== "number" || fishCount < 0) {
        return badRequest("fishCount must be a non-negative number");
    }

    const userId = decoded.sub;
    const id = `${userId}::${createdAt}::${localId}`;
    const syncedAt = new Date().toISOString();

    try {
        // For idempotency: we store offline records in the images table with these fields
        // Using INSERT IGNORE (safe to re-run)
        await pool.execute(
            `INSERT IGNORE INTO images 
             (imageId, userId, status, createdAt, analysisResult, latitude, longitude)
             VALUES (?, ?, 'completed', ?, ?, ?, ?)`,
            [
                id,
                userId,
                createdAt,
                JSON.stringify({
                    localId,
                    imageUri: imageUri || "",
                    processingTime: Number(processingTime) || 0,
                    fishCount: Number(fishCount),
                    avgConfidence: Number(avgConfidence) || 0,
                    speciesDistribution: speciesDistribution || {},
                    diseaseDetected: Boolean(diseaseDetected),
                    detections: detections || [],
                    syncedAt,
                }),
                location?.lat ?? null,
                location?.lng ?? null,
            ]
        );

        return ok({ id, remoteId: id });
    } catch (err) {
        console.error("[saveOfflineAnalysis] MySQL error:", err);
        return serverError("Failed to save offline analysis");
    }
};
