/**
 * Lambda: GET /map
 *
 * Returns geo-tagged catch records with lat/lng for map rendering.
 * Supports optional query filters: ?species=Pomfret&from=2026-02-01&to=2026-02-28
 */
const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const { species, from, to } = event.queryStringParameters || {};

    try {
        let keyCondition = "#s = :completed";
        const expressionValues = { ":completed": "completed", ":numType": "N" };
        let filterExpression = "attribute_exists(latitude) AND attribute_exists(longitude) AND attribute_type(latitude, :numType) AND attribute_type(longitude, :numType)";
        const expressionNames = { "#s": "status" };

        // Optional date range filter
        if (from && to) {
            keyCondition += " AND createdAt BETWEEN :from AND :to";
            expressionValues[":from"] = from;
            expressionValues[":to"] = to + "T23:59:59Z";
        }

        // Optional species filter
        if (species) {
            filterExpression += " AND analysisResult.species = :species";
            expressionValues[":species"] = species;
        }

        const result = await ddb.send(
            new QueryCommand({
                TableName: IMAGES_TABLE,
                IndexName: "status-createdAt-index",
                KeyConditionExpression: keyCondition,
                FilterExpression: filterExpression,
                ExpressionAttributeNames: expressionNames,
                ExpressionAttributeValues: expressionValues,
                Limit: 200,
                ScanIndexForward: false,
                ProjectionExpression: "imageId, latitude, longitude, createdAt, analysisResult",
            })
        );

        const markers = (result.Items || []).map((item) => ({
            imageId: item.imageId,
            latitude: item.latitude,
            longitude: item.longitude,
            species: item.analysisResult?.species,
            qualityGrade: item.analysisResult?.qualityGrade,
            weight_g: item.analysisResult?.measurements?.weight_g,
            createdAt: item.createdAt,
        })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

        return ok({ markers });
    } catch (err) {
        console.error("getMapData error:", err);
        return serverError("Failed to fetch map data");
    }
};
