/**
 * Lambda: POST /weight-estimates
 *
 * Persists a user-entered fish weight estimate into the groups
 * record so that the updated weight is visible on the web dashboard.
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

    const { groupId, imageUri, fishIndex, species, weightG, timestamp, fullEstimate } = body;

    if (!imageUri || fishIndex === undefined || !species || weightG === undefined) {
        return badRequest("Missing required fields: imageUri, fishIndex, species, weightG");
    }

    if (typeof weightG !== "number" || weightG <= 0) {
        return badRequest("weightG must be a positive number");
    }

    if (!groupId) {
        return badRequest("Missing required field: groupId");
    }

    const userId = decoded.sub;

    try {
        // Fetch the record - could be in groups or images table
        let record = null;
        let tableName = "groups";
        let keyCol = "groupId";

        const [groupRows] = await pool.execute(
            "SELECT * FROM `groups` WHERE groupId = ?",
            [groupId]
        );

        if (groupRows.length > 0) {
            record = groupRows[0];
            if (record.analysisResult && typeof record.analysisResult === 'string') {
                record.analysisResult = JSON.parse(record.analysisResult);
            }
            if (record.weightEstimates && typeof record.weightEstimates === 'string') {
                record.weightEstimates = JSON.parse(record.weightEstimates);
            }
        } else {
            const [imageRows] = await pool.execute(
                "SELECT * FROM images WHERE imageId = ?",
                [groupId]
            );
            if (imageRows.length > 0) {
                record = imageRows[0];
                if (record.analysisResult && typeof record.analysisResult === 'string') {
                    record.analysisResult = JSON.parse(record.analysisResult);
                }
                tableName = "images";
                keyCol = "imageId";
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

        const existing = record.weightEstimates || {};
        const updatedMap = { ...existing, [fishKey]: estimateEntry };

        const totalWeightKg = Object.values(updatedMap).reduce((s, v) => {
            if (typeof v === 'number') return s + v;
            if (v && typeof v === 'object' && v.weightKg) return s + v.weightKg;
            return s;
        }, 0);

        const totalValueInr = Object.values(updatedMap).reduce((s, v) => {
            if (v && typeof v === 'object' && v.estimated_fish_value) {
                return s + ((v.estimated_fish_value.min_inr + v.estimated_fish_value.max_inr) / 2);
            }
            return s;
        }, 0);

        const now = new Date().toISOString();
        const updatedMapJson = JSON.stringify(updatedMap);

        if (tableName === "groups") {
            // Also update aggregateStats if present
            const hasAggStats = record.analysisResult?.aggregateStats !== undefined;
            if (hasAggStats) {
                const updatedAr = {
                    ...record.analysisResult,
                    aggregateStats: {
                        ...record.analysisResult.aggregateStats,
                        totalEstimatedWeight: totalWeightKg,
                        totalEstimatedValue: Math.round(totalValueInr),
                    }
                };
                await pool.execute(
                    "UPDATE `groups` SET weightEstimates = ?, analysisResult = ?, updatedAt = ? WHERE groupId = ?",
                    [updatedMapJson, JSON.stringify(updatedAr), now, groupId]
                );
            } else {
                await pool.execute(
                    "UPDATE `groups` SET weightEstimates = ?, updatedAt = ? WHERE groupId = ?",
                    [updatedMapJson, now, groupId]
                );
            }
        } else {
            await pool.execute(
                "UPDATE images SET weightEstimates = ?, updatedAt = ? WHERE imageId = ?",
                [updatedMapJson, now, groupId]
            );
        }

        console.log(`[saveWeightEstimate] group=${groupId} ${fishKey}=${weightKg} kg (total=${totalWeightKg} kg)`);
        return ok({ stored: true, groupId, fishKey, weightKg, totalWeightKg });

    } catch (err) {
        console.error("[saveWeightEstimate] MySQL error:", err);
        return serverError("Failed to save weight estimate");
    }
};
