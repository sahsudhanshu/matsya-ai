/**
 * Lambda: GET /images
 *
 * Returns all images uploaded by the authenticated user.
 * Queries DynamoDB userId-GSI.
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
    const username = decoded.username;
    const limit = Number(event.queryStringParameters?.limit || 50);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50;

    const queryByUserId = async (uid) => {
        const result = await ddb.send(
            new QueryCommand({
                TableName: IMAGES_TABLE,
                IndexName: "userId-createdAt-index",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": uid },
                ScanIndexForward: false,
                Limit: safeLimit,
            })
        );
        return result.Items || [];
    };

    try {
        const primaryItems = await queryByUserId(userId);
        let merged = primaryItems;

        if (username && username !== userId) {
            const legacyItems = await queryByUserId(username);
            const byId = new Map();
            for (const item of [...primaryItems, ...legacyItems]) {
                byId.set(item.imageId, item);
            }
            merged = [...byId.values()].sort((a, b) =>
                (b.createdAt || "").localeCompare(a.createdAt || "")
            );
        }

        return ok({ images: merged.slice(0, safeLimit) });
    } catch (err) {
        console.error("getImages error:", err);
        return serverError("Failed to fetch images");
    }
};
