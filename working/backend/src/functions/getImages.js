/**
 * Lambda: GET /images
 *
 * Returns all images uploaded by the authenticated user.
 * Queries MySQL images table.
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
    const username = decoded.username;
    const limit = Number(event.queryStringParameters?.limit || 50);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50;

    try {
        const [primaryItems] = await pool.execute(
            `SELECT * FROM images WHERE userId = ? ORDER BY createdAt DESC LIMIT ${safeLimit}`,
            [userId]
        );

        let merged = primaryItems;

        if (username && username !== userId) {
            const [legacyItems] = await pool.execute(
                `SELECT * FROM images WHERE userId = ? ORDER BY createdAt DESC LIMIT ${safeLimit}`,
                [username]
            );
            const byId = new Map();
            for (const item of [...primaryItems, ...legacyItems]) {
                if (item.analysisResult && typeof item.analysisResult === 'string') {
                    item.analysisResult = JSON.parse(item.analysisResult);
                }
                byId.set(item.imageId, item);
            }
            merged = [...byId.values()].sort((a, b) =>
                (b.createdAt || "").localeCompare(a.createdAt || "")
            );
        } else {
            merged = primaryItems.map(item => {
                if (item.analysisResult && typeof item.analysisResult === 'string') {
                    item.analysisResult = JSON.parse(item.analysisResult);
                }
                return item;
            });
        }

        return ok({ images: merged.slice(0, safeLimit) });
    } catch (err) {
        console.error("getImages error:", err);
        return serverError("Failed to fetch images");
    }
};
