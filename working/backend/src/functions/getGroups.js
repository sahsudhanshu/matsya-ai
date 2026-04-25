/**
 * Lambda: GET /groups
 *
 * Returns paginated group history for the authenticated user.
 * Merges results from Groups_Table and legacy images table.
 * 
 * Validates: Requirements 12.4, 12.6, 6.2, 6.3, 6.4, 6.5
 */
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");
const { getMergedHistory } = require("../utils/groupHistory");

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    // Verify authentication
    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;

    // Parse query parameters
    const limit = Number(event.queryStringParameters?.limit || 20);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    try {
        // Get merged history from both groups and legacy images
        const result = await getMergedHistory(userId, { limit: safeLimit });

        return ok({
            items: result.items,
            lastKey: result.lastKey,
        });
    } catch (err) {
        console.error("getGroups error:", err);
        return serverError("Failed to fetch group history");
    }
};
