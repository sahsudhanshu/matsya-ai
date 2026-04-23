/**
 * Lambda: GET /chat
 *
 * Returns the chat history for the authenticated user.
 */
const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

const CHATS_TABLE = process.env.DYNAMODB_CHATS_TABLE || "ai-bharat-chats";

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const limit = parseInt(event.queryStringParameters?.limit || "50");

    try {
        const result = await ddb.send(
            new QueryCommand({
                TableName: CHATS_TABLE,
                IndexName: "userId-timestamp-index",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false, // newest first
                Limit: Math.min(limit, 100),
            })
        );

        // Reverse to chronological order for display
        const chats = (result.Items || []).reverse();
        return ok({ chats });
    } catch (err) {
        console.error("getChatHistory error:", err);
        return serverError("Failed to fetch chat history");
    }
};
