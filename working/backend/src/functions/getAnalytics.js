/**
 * Lambda: GET /analytics
 *
 * Returns aggregate analytics for the authenticated user.
 * Computes stats from MySQL images + groups records.
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

    try {
        // Fetch all completed images for the user (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sinceStr = sixMonthsAgo.toISOString();

        const [imagesItems] = await pool.execute(
            `SELECT * FROM images WHERE userId = ? AND createdAt >= ? AND status = 'completed' ORDER BY createdAt ASC`,
            [userId, sinceStr]
        );

        // Fetch all completed groups for the user (last 6 months)
        const [groupsItems] = await pool.execute(
            `SELECT * FROM \`groups\` WHERE userId = ? AND createdAt >= ? AND status = 'completed' ORDER BY createdAt ASC`,
            [userId, sinceStr]
        );



        // ── Compute stats ─────────────────────────────────────────────────────────
        let totalEarnings = 0;
        let totalWeight = 0;
        let totalImagesCount = imagesItems.length;
        let totalCatches = imagesItems.length;
        const speciesCounts = {};
        const qualityCounts = {};
        const weeklyMap = {};

        const addWeekly = (dateString, value, catches) => {
            const d = new Date(dateString);
            const weekNum = Math.ceil(d.getDate() / 7);
            const weekKey = `${d.getFullYear()}-W${d.getMonth() + 1}-${weekNum}`;
            if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { earnings: 0, catches: 0 };
            weeklyMap[weekKey].earnings += value;
            weeklyMap[weekKey].catches += catches;
        };

        for (const item of imagesItems) {
            const ar = (typeof item.analysisResult === 'string' ? JSON.parse(item.analysisResult) : item.analysisResult) || {};
            const value = ar.marketEstimate?.estimated_value || 0;
            const weight = ar.measurements?.weight_g || 0;
            const species = ar.species || "Unknown";
            const grade = ar.qualityGrade || "Unknown";

            totalEarnings += value;
            totalWeight += weight;
            speciesCounts[species] = (speciesCounts[species] || 0) + 1;
            qualityCounts[grade] = (qualityCounts[grade] || 0) + 1;

            addWeekly(item.createdAt, value, 1);
        }

        for (const item of groupsItems) {
            const ar = (typeof item.analysisResult === 'string' ? JSON.parse(item.analysisResult) : item.analysisResult) || {};
            const stats = ar.aggregateStats || {};

            const value = stats.totalEstimatedValue || 0;
            const weight_kg = stats.totalEstimatedWeight || 0;
            const weight_g = weight_kg * 1000;
            const fishCount = stats.totalFishCount || 0;

            totalEarnings += value;
            totalWeight += weight_g;
            totalCatches += fishCount;
            totalImagesCount += (item.imageCount || 1);

            if (stats.speciesDistribution) {
                for (const [species, count] of Object.entries(stats.speciesDistribution)) {
                    speciesCounts[species] = (speciesCounts[species] || 0) + count;
                }
            }

            addWeekly(item.createdAt, value, fishCount);
        }

        const avgWeight = totalCatches > 0 ? totalWeight / totalCatches : 0;

        const topSpecies = Object.entries(speciesCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

        const speciesBreakdown = Object.entries(speciesCounts).map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / totalCatches) * 100) || 0,
        }));

        const qualityDistribution = Object.entries(qualityCounts).map(([grade, count]) => ({
            grade,
            count,
        }));

        const weeklyTrend = Object.entries(weeklyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-8)
            .map(([date, data]) => ({ date, ...data }));

        return ok({
            totalImages: totalImagesCount,
            totalCatches,
            totalEarnings: Math.round(totalEarnings),
            avgWeight: Math.round(avgWeight),
            topSpecies,
            weeklyTrend,
            speciesBreakdown,
            qualityDistribution,
        });
    } catch (err) {
        console.error("getAnalytics error:", err);
        return serverError("Failed to compute analytics");
    }
};
