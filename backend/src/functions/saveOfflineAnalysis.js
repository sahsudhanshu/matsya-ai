/**
 * Lambda: POST /offline-analyses
 *
 * Persists an offline (on-device) fish analysis record to DynamoDB.
 * Called by the mobile app when connectivity is restored after an offline scan.
 *
 * Body:
 *   localId          {string}   - client-generated ID for deduplication / callback
 *   createdAt        {string}   - ISO-8601 device timestamp of the scan
 *   imageUri         {string}   - local file URI (not accessible on backend, stored for reference)
 *   location         {object?}  - { lat, lng } GPS coordinates
 *   processingTime   {number}   - inference time in milliseconds
 *   fishCount        {number}
 *   avgConfidence    {number}   - 0–1
 *   speciesDistribution {object} - { speciesName: count }
 *   diseaseDetected  {boolean}
 *   detections       {array}    - per-fish detections (species, disease, quality, bbox, …)
 *
 * Returns: { id }  - backend-assigned record ID
 */
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const TABLE = process.env.DYNAMODB_OFFLINE_ANALYSES_TABLE || "";

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

    try {
        await ddb.send(new PutCommand({
            TableName: TABLE,
            // Idempotent - re-syncing the same localId just overwrites cleanly
            ConditionExpression: "attribute_not_exists(#id) OR #id = :id",
            ExpressionAttributeNames: { "#id": "id" },
            ExpressionAttributeValues: { ":id": id },
            Item: {
                id,
                userId,
                localId,
                createdAt,
                imageUri: imageUri || "",
                latitude: location?.lat ?? null,
                longitude: location?.lng ?? null,
                processingTime: Number(processingTime) || 0,
                fishCount: Number(fishCount),
                avgConfidence: Number(avgConfidence) || 0,
                speciesDistribution: speciesDistribution || {},
                diseaseDetected: Boolean(diseaseDetected),
                detections: detections || [],
                syncedAt: new Date().toISOString(),
            },
        }));

        return ok({ id, remoteId: id });
    } catch (err) {
        // PK already exists - treat as already synced (idempotent success)
        if (err.name === "ConditionalCheckFailedException") {
            return ok({ id, remoteId: id });
        }
        console.error("[saveOfflineAnalysis] DynamoDB error:", err);
        return serverError("Failed to save offline analysis");
    }
};
