/**
 * Lambda: GET /chat
 *
 * Returns the chat history for the authenticated user.
 */
const { pool } = require("../utils/db");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50"), 100);

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM chats WHERE userId = ? ORDER BY timestamp ASC LIMIT ?`,
            [userId, limit]
        );
        return ok({ chats: rows });
    } catch (err) {
        console.error("getChatHistory error:", err);
        return serverError("Failed to fetch chat history");
    }
};
