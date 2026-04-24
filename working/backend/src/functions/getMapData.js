/**
 * Lambda: GET /map
 *
 * Returns geo-tagged catch records with lat/lng for map rendering.
 * Supports optional query filters: ?species=Pomfret&from=2026-02-01&to=2026-02-28
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

    const { species, from, to } = event.queryStringParameters || {};

    try {
        let query = `SELECT imageId, latitude, longitude, createdAt, analysisResult 
                     FROM images 
                     WHERE status = 'completed' AND latitude IS NOT NULL AND longitude IS NOT NULL`;
        const params = [];

        if (from && to) {
            query += ` AND createdAt BETWEEN ? AND ?`;
            params.push(from, to + "T23:59:59Z");
        }

        query += ` ORDER BY createdAt DESC LIMIT 200`;

        const [rows] = await pool.execute(query, params);

        const markers = rows
            .map((item) => {
                const ar = typeof item.analysisResult === 'string'
                    ? JSON.parse(item.analysisResult)
                    : (item.analysisResult || {});
                return {
                    imageId: item.imageId,
                    latitude: parseFloat(item.latitude),
                    longitude: parseFloat(item.longitude),
                    species: ar.species,
                    qualityGrade: ar.qualityGrade,
                    weight_g: ar.measurements?.weight_g,
                    createdAt: item.createdAt,
                };
            })
            .filter((item) => {
                if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return false;
                if (species && item.species !== species) return false;
                return true;
            });

        return ok({ markers });
    } catch (err) {
        console.error("getMapData error:", err);
        return serverError("Failed to fetch map data");
    }
};
