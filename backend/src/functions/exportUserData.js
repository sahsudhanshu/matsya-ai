/**
 * Lambda: GET /user/export
 *
 * Exports all catch data for the authenticated user as CSV.
 * Queries both the images and groups tables, merges results,
 * and returns a CSV string.
 */
const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { unauthorized, serverError } = require("../utils/response");

const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "";
const GROUPS_TABLE = process.env.GROUPS_TABLE || "";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Flatten a group's analysisResult into individual fish rows.
 */
function flattenGroupToCsvRows(group) {
    const rows = [];
    const analysis = group.analysisResult;
    if (!analysis || !analysis.individual_results) {
        rows.push({
            type: "group",
            id: group.groupId,
            date: group.createdAt || "",
            latitude: group.latitude || "",
            longitude: group.longitude || "",
            species: "",
            confidence: "",
            weight_g: "",
            freshness: "",
            quality_grade: "",
            image_count: group.imageCount || 0,
            status: group.status || "",
        });
        return rows;
    }

    for (const [key, result] of Object.entries(analysis.individual_results)) {
        const crops = result.crops || {};
        for (const [cropKey, crop] of Object.entries(crops)) {
            rows.push({
                type: "group",
                id: group.groupId,
                date: group.createdAt || "",
                latitude: group.latitude || "",
                longitude: group.longitude || "",
                species: crop.species?.name || "",
                confidence: crop.species?.confidence || "",
                weight_g: crop.weight?.estimated_weight_g || "",
                freshness: crop.freshness?.classification || "",
                quality_grade: crop.quality?.grade || "",
                image_count: group.imageCount || 0,
                status: group.status || "",
            });
        }
    }

    if (rows.length === 0) {
        rows.push({
            type: "group",
            id: group.groupId,
            date: group.createdAt || "",
            latitude: group.latitude || "",
            longitude: group.longitude || "",
            species: analysis.summary?.dominant_species || "",
            confidence: "",
            weight_g: analysis.summary?.total_weight_g || "",
            freshness: "",
            quality_grade: "",
            image_count: group.imageCount || 0,
            status: group.status || "",
        });
    }

    return rows;
}

/**
 * Flatten a single image record into CSV rows.
 */
function flattenImageToCsvRows(image) {
    const rows = [];
    const analysis = image.analysisResult;
    if (!analysis || !analysis.crops) {
        rows.push({
            type: "image",
            id: image.imageId,
            date: image.createdAt || "",
            latitude: image.latitude || "",
            longitude: image.longitude || "",
            species: "",
            confidence: "",
            weight_g: "",
            freshness: "",
            quality_grade: "",
            image_count: 1,
            status: image.status || "",
        });
        return rows;
    }

    for (const [key, crop] of Object.entries(analysis.crops)) {
        rows.push({
            type: "image",
            id: image.imageId,
            date: image.createdAt || "",
            latitude: image.latitude || "",
            longitude: image.longitude || "",
            species: crop.species?.name || "",
            confidence: crop.species?.confidence || "",
            weight_g: crop.weight?.estimated_weight_g || "",
            freshness: crop.freshness?.classification || "",
            quality_grade: crop.quality?.grade || "",
            image_count: 1,
            status: image.status || "",
        });
    }

    return rows;
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const username = decoded.username;

    try {
        // Query groups
        const groupsResult = await ddb.send(
            new QueryCommand({
                TableName: GROUPS_TABLE,
                IndexName: "userId-createdAt-index",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false,
            })
        );
        const groups = groupsResult.Items || [];

        // Query images
        const imagesResult = await ddb.send(
            new QueryCommand({
                TableName: IMAGES_TABLE,
                IndexName: "userId-createdAt-index",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false,
            })
        );
        let images = imagesResult.Items || [];

        // Also query by username if different (legacy data)
        if (username && username !== userId) {
            const legacyResult = await ddb.send(
                new QueryCommand({
                    TableName: IMAGES_TABLE,
                    IndexName: "userId-createdAt-index",
                    KeyConditionExpression: "userId = :uid",
                    ExpressionAttributeValues: { ":uid": username },
                    ScanIndexForward: false,
                })
            );
            const legacyImages = legacyResult.Items || [];
            const byId = new Map();
            for (const item of [...images, ...legacyImages]) {
                byId.set(item.imageId, item);
            }
            images = [...byId.values()];
        }

        // Flatten all to CSV rows
        const allRows = [];
        for (const group of groups) {
            allRows.push(...flattenGroupToCsvRows(group));
        }
        for (const image of images) {
            allRows.push(...flattenImageToCsvRows(image));
        }

        // Sort by date descending
        allRows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        // Build CSV
        const headers = [
            "Type", "ID", "Date", "Latitude", "Longitude",
            "Species", "Confidence", "Weight (g)", "Freshness",
            "Quality Grade", "Image Count", "Status",
        ];

        const csvLines = [headers.join(",")];
        for (const row of allRows) {
            csvLines.push([
                row.type,
                row.id,
                row.date,
                row.latitude,
                row.longitude,
                `"${row.species}"`,
                row.confidence,
                row.weight_g,
                `"${row.freshness}"`,
                row.quality_grade,
                row.image_count,
                row.status,
            ].join(","));
        }

        const csv = csvLines.join("\n");

        return {
            statusCode: 200,
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="matsya-ai-catch-data-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
            body: csv,
        };
    } catch (err) {
        console.error("exportUserData error:", err);
        return serverError("Failed to export data");
    }
};
