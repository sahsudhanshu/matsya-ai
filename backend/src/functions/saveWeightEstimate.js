/**
 * Lambda: POST /weight-estimates
 *
 * Persists a user-entered fish weight estimate into the ai-bharat-groups
 * record so that the updated weight is visible on the web dashboard.
 *
 * If `groupId` is absent (offline-only session not yet synced) the call
 * succeeds silently - the weight is already persisted locally on device and
 * will be included when the offline analysis itself syncs.
 *
 * Body:
 *   groupId    {string?} - cloud group ID (present for online / synced records)
 *   imageUri   {string}  - local URI used as a correlation key
 *   fishIndex  {number}  - zero-based index of the fish within the analysis
 *   species    {string}  - identified species name
 *   weightG    {number}  - estimated weight in grams
 *   timestamp  {string}  - ISO-8601 timestamp from the mobile device
 */
const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const GROUPS_TABLE = process.env.GROUPS_TABLE || "";
const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "";

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

    const { groupId, imageUri, fishIndex, species, weightG, timestamp, fullEstimate } = body;

    if (!imageUri || fishIndex === undefined || !species || weightG === undefined) {
        return badRequest("Missing required fields: imageUri, fishIndex, species, weightG");
    }

    if (typeof weightG !== "number" || weightG <= 0) {
        return badRequest("weightG must be a positive number");
    }

    // No groupId means the record is offline-only and not yet synced to cloud.
    // Return success so the mobile queue item is cleared and not retried.
    if (!groupId) {
        return ok({ stored: false, reason: "no_group_id" });
    }

    const userId = decoded.sub;

    try {
        // Fetch the record - could be in groups table (group sessions) or images table (single sessions).
        let record = null;
        let tableName = GROUPS_TABLE;
        let keyAttr = "groupId";

        const { Item: group } = await ddb.send(new GetCommand({
            TableName: GROUPS_TABLE,
            Key: { groupId },
        }));

        if (group) {
            record = group;
        } else {
            // Fallback: check the images table (single offline sessions use imageId = groupId)
            const { Item: image } = await ddb.send(new GetCommand({
                TableName: IMAGES_TABLE,
                Key: { imageId: groupId },
            }));
            if (image) {
                record = image;
                tableName = IMAGES_TABLE;
                keyAttr = "imageId";
            }
        }

        if (!record) {
            return badRequest("Group not found");
        }
        if (record.userId !== userId) {
            return unauthorized();
        }

        const weightKg = weightG / 1000;
        const fishKey = `fish_${Number(fishIndex)}`;

        // Store the full estimate object if provided, otherwise just the weight
        const estimateEntry = fullEstimate ? {
            weightKg,
            species,
            estimated_weight_grams: fullEstimate.estimated_weight_grams,
            estimated_weight_range: fullEstimate.estimated_weight_range,
            market_price_per_kg: fullEstimate.market_price_per_kg,
            estimated_fish_value: fullEstimate.estimated_fish_value,
            quality_grade: fullEstimate.quality_grade,
            notes: fullEstimate.notes,
            timestamp: timestamp || new Date().toISOString(),
        } : weightKg;

        // Merge the new weight into the existing per-fish estimates map and
        // recompute the aggregate total.
        const existing = record.weightEstimates || {};
        const updatedMap = { ...existing, [fishKey]: estimateEntry };

        // Calculate total weight from all entries (handle both old numeric and new object format)
        const totalWeightKg = Object.values(updatedMap).reduce((s, v) => {
            if (typeof v === 'number') return s + v;
            if (v && typeof v === 'object' && v.weightKg) return s + v.weightKg;
            return s;
        }, 0);

        // Calculate total value from all entries
        const totalValueInr = Object.values(updatedMap).reduce((s, v) => {
            if (v && typeof v === 'object' && v.estimated_fish_value) {
                return s + ((v.estimated_fish_value.min_inr + v.estimated_fish_value.max_inr) / 2);
            }
            return s;
        }, 0);

        // Build the update - also patch aggregateStats if they exist on the record.
        const hasAggregateStats = record.analysisResult?.aggregateStats !== undefined;
        const updateExpr = hasAggregateStats
            ? "SET weightEstimates = :wm, analysisResult.aggregateStats.totalEstimatedWeight = :tw, analysisResult.aggregateStats.totalEstimatedValue = :tv, updatedAt = :ua"
            : "SET weightEstimates = :wm, updatedAt = :ua";

        await ddb.send(new UpdateCommand({
            TableName: tableName,
            Key: { [keyAttr]: groupId },
            UpdateExpression: updateExpr,
            ExpressionAttributeValues: {
                ":wm": updatedMap,
                ...(hasAggregateStats && { ":tw": totalWeightKg, ":tv": Math.round(totalValueInr) }),
                ":ua": new Date().toISOString(),
            },
        }));

        console.log(`[saveWeightEstimate] group=${groupId} ${fishKey}=${weightKg} kg (total=${totalWeightKg} kg)`);
        return ok({ stored: true, groupId, fishKey, weightKg, totalWeightKg });

    } catch (err) {
        console.error("[saveWeightEstimate] DynamoDB error:", err);
        return serverError("Failed to save weight estimate");
    }
};
