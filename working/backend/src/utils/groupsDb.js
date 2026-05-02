/**
 * MySQL operations for Groups_Table (ai-bharat-groups / groups tabular)
 */

const { pool } = require("./db");

/**
 * Transform a legacy single-image record to group format
 */
function transformLegacyToGroup(legacyRecord) {
    if (!legacyRecord) return null;
    let primarySpecies = null;
    let totalFishCount = 0;
    let transformedAnalysis = null;

    // Check if legacyRecord.analysisResult is string, parse if needed
    const arObj = typeof legacyRecord.analysisResult === 'string' 
        ? JSON.parse(legacyRecord.analysisResult) 
        : legacyRecord.analysisResult;

    if (arObj) {
        const ar = arObj;
        primarySpecies = ar.species;
        const dets = ar.allDetections || [];
        totalFishCount = dets.length || 1;
        const crops = {};
        const detectionsList = [];
        const speciesDistribution = {};

        if (dets.length > 0) {
            dets.forEach((d, i) => {
                crops[`crop_${i}`] = {
                    crop_url: d.cropUrl || null,
                    species: {
                        label: d.species || ar.species,
                        confidence: d.speciesConfidence || ar.confidence,
                        gradcam_url: d.gradcamUrl || null,
                    },
                    disease: {
                        label: d.disease || "Healthy",
                        confidence: d.diseaseConfidence || 1.0,
                        gradcam_url: d.gradcamUrl || null,
                    },
                    bbox: d.bbox,
                    yolo_confidence: d.speciesConfidence || ar.confidence,
                    measurements: d.measurements || ar.measurements,
                    weight_kg: d.weightG ? d.weightG / 1000 : ar.weightEstimate,
                    estimatedValue: d.estimatedValue || ar.marketEstimate?.estimated_value,
                };
                const sp = d.species || ar.species || "Unknown";
                speciesDistribution[sp] = (speciesDistribution[sp] || 0) + 1;
                detectionsList.push({
                    cropUrl: d.cropUrl || "",
                    species: sp,
                    confidence: d.speciesConfidence || ar.confidence || 0,
                    diseaseStatus: d.disease || "Healthy",
                    diseaseConfidence: d.diseaseConfidence || 1.0,
                    weight: d.weightG ? d.weightG / 1000 : ar.weightEstimate || 0,
                    value: d.estimatedValue || ar.marketEstimate?.estimated_value || 0,
                    gradcamUrls: {
                        species: d.gradcamUrl || "",
                        disease: d.gradcamUrl || "",
                    },
                });
            });
        } else {
            crops["0"] = {
                crop_url: ar.debugUrls?.cropImageUrl || ar.cropUrl || null,
                species: {
                    label: ar.species,
                    confidence: ar.confidence,
                    gradcam_url: ar.debugUrls?.gradcamUrl || ar.gradcamUrl || null,
                },
                disease: {
                    label: ar.disease || "Healthy",
                    confidence: ar.diseaseConfidence || 1.0,
                    gradcam_url: ar.debugUrls?.gradcamUrl || ar.gradcamUrl || null,
                },
                weight_kg: ar.weightEstimate,
                estimatedValue: ar.marketEstimate?.estimated_value,
            };
            speciesDistribution[ar.species] = 1;
            detectionsList.push({
                cropUrl: ar.debugUrls?.cropImageUrl || ar.cropUrl || "",
                species: ar.species || "Unknown",
                confidence: ar.confidence || 0,
                diseaseStatus: ar.disease || "Healthy",
                diseaseConfidence: ar.diseaseConfidence || 1.0,
                weight: ar.weightEstimate || 0,
                value: ar.marketEstimate?.estimated_value || 0,
                gradcamUrls: {
                    species: ar.debugUrls?.gradcamUrl || ar.gradcamUrl || "",
                    disease: "",
                },
            });
        }

        const diseaseDetected = detectionsList.some(d => {
            const status = (d.diseaseStatus || "").toLowerCase();
            return status !== "healthy" && status !== "healthy fish";
        });

        transformedAnalysis = {
            images: [
                {
                    imageIndex: 0,
                    s3Key: legacyRecord.s3Key || null, // we don't have s3Key directly on legacy images table sometimes
                    yolo_image_url: ar.debugUrls?.yoloImageUrl,
                    crops,
                },
            ],
            aggregateStats: {
                totalFishCount,
                speciesDistribution,
                averageConfidence: ar.confidence,
                diseaseDetected,
                totalEstimatedWeight: ar.weightEstimate,
                totalEstimatedValue: ar.marketEstimate?.estimated_value || 0,
            },
            detections: detectionsList,
            yoloVisualizationUrls: ar.debugUrls?.yoloImageUrl
                ? [ar.debugUrls.yoloImageUrl]
                : [],
            processedAt: ar.timestamp || legacyRecord.createdAt,
        };
    }

    return {
        groupId: legacyRecord.imageId,
        userId: legacyRecord.userId,
        imageCount: 1,
        status: legacyRecord.status || "completed",
        createdAt: legacyRecord.createdAt,
        updatedAt: legacyRecord.updatedAt || legacyRecord.createdAt,
        primarySpecies,
        totalFishCount,
        s3Keys: legacyRecord.s3Key ? [legacyRecord.s3Key] : [],
        analysisResult: transformedAnalysis,
        isLegacy: true,
        latitude: legacyRecord.latitude,
        longitude: legacyRecord.longitude
    };
}

async function createGroup(groupData) {
    const now = new Date().toISOString();
    
    // Insert into MySQL
    const s3KeysJson = groupData.s3Keys ? JSON.stringify(groupData.s3Keys) : '[]';
    
    try {
        await pool.execute(
            `INSERT INTO \`groups\` (groupId, userId, imageCount, s3Keys, status, createdAt, updatedAt, latitude, longitude)
             VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
            [
                groupData.groupId,
                groupData.userId,
                groupData.imageCount || 0,
                s3KeysJson,
                now,
                now,
                groupData.latitude || null,
                groupData.longitude || null
            ]
        );

        return {
            ...groupData,
            status: "pending",
            createdAt: now,
            updatedAt: now,
        };
    } catch (error) {
        console.error("Error creating group:", error);
        throw new Error(`Failed to create group: ${error.message}`);
    }
}

async function getGroup(groupId) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM \`groups\` WHERE groupId = ?`, [groupId]);
        if (rows.length === 0) return null;
        
        const group = rows[0];
        if (group.s3Keys && typeof group.s3Keys === 'string') group.s3Keys = JSON.parse(group.s3Keys);
        if (group.analysisResult && typeof group.analysisResult === 'string') group.analysisResult = JSON.parse(group.analysisResult);
        if (group.errors && typeof group.errors === 'string') group.errors = JSON.parse(group.errors);
        if (group.weightEstimates && typeof group.weightEstimates === 'string') group.weightEstimates = JSON.parse(group.weightEstimates);
        if (group.latitude !== null && group.latitude !== undefined) group.latitude = Number(group.latitude);
        if (group.longitude !== null && group.longitude !== undefined) group.longitude = Number(group.longitude);
        
        return group;
    } catch (error) {
        console.error("Error getting group:", error);
        throw new Error(`Failed to get group: ${error.message}`);
    }
}

async function queryGroupsByUserId(userId, options = {}) {
    const limit = parseInt(options.limit, 10) || 20;
    const offset = parseInt(options.lastKey, 10) || 0;

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM \`groups\` WHERE userId = ? ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
            [userId]
        );
        
        const items = rows.map(group => {
            if (group.s3Keys && typeof group.s3Keys === 'string') group.s3Keys = JSON.parse(group.s3Keys);
            if (group.analysisResult && typeof group.analysisResult === 'string') group.analysisResult = JSON.parse(group.analysisResult);
            if (group.errors && typeof group.errors === 'string') group.errors = JSON.parse(group.errors);
            if (group.weightEstimates && typeof group.weightEstimates === 'string') group.weightEstimates = JSON.parse(group.weightEstimates);
            if (group.latitude !== null && group.latitude !== undefined) group.latitude = Number(group.latitude);
            if (group.longitude !== null && group.longitude !== undefined) group.longitude = Number(group.longitude);
            return group;
        });

        let nextKey = null;
        if (rows.length === limit) {
            nextKey = offset + limit;
        }

        return {
            items,
            lastKey: nextKey
        };
    } catch (error) {
        console.error("Error querying groups by userId:", error);
        throw new Error(`Failed to query groups: ${error.message}`);
    }
}

async function updateGroupStatus(groupId, status) {
    const now = new Date().toISOString();

    try {
        await pool.execute(
            `UPDATE \`groups\` SET status = ?, updatedAt = ? WHERE groupId = ?`,
            [status, now, groupId]
        );
        return await getGroup(groupId);
    } catch (error) {
        console.error("Error updating group status:", error);
        throw new Error(`Failed to update group status: ${error.message}`);
    }
}

async function updateGroupAnalysis(groupId, analysisResult) {
    const now = new Date().toISOString();
    const resultJson = JSON.stringify(analysisResult);

    try {
        await pool.execute(
            `UPDATE \`groups\` SET analysisResult = ?, updatedAt = ? WHERE groupId = ?`,
            [resultJson, now, groupId]
        );
        return await getGroup(groupId);
    } catch (error) {
        console.error("Error updating group analysis:", error);
        throw new Error(`Failed to update group analysis: ${error.message}`);
    }
}

async function updateGroupAnalysisAndStatus(groupId, analysisResult, status) {
    const now = new Date().toISOString();
    const resultJson = JSON.stringify(analysisResult);

    try {
        await pool.execute(
            `UPDATE \`groups\` SET analysisResult = ?, status = ?, updatedAt = ? WHERE groupId = ?`,
            [resultJson, status, now, groupId]
        );
        return await getGroup(groupId);
    } catch (error) {
        console.error("Error updating group analysis and status:", error);
        throw new Error(`Failed to update group analysis and status: ${error.message}`);
    }
}

async function addGroupError(groupId, errorInfo) {
    const now = new Date().toISOString();
    const errorJson = JSON.stringify(errorInfo);

    try {
        await pool.execute(
            `UPDATE \`groups\` 
             SET errors = JSON_ARRAY_APPEND(COALESCE(errors, JSON_ARRAY()), '$', CAST(? AS JSON)), updatedAt = ? 
             WHERE groupId = ?`,
            [errorJson, now, groupId]
        );
        return await getGroup(groupId);
    } catch (error) {
        console.error("Error adding group error:", error);
        throw new Error(`Failed to add group error: ${error.message}`);
    }
}

async function deleteGroup(groupId) {
    try {
        await pool.execute(`DELETE FROM \`groups\` WHERE groupId = ?`, [groupId]);
    } catch (error) {
        console.error("Error deleting group:", error);
        throw new Error(`Failed to delete group: ${error.message}`);
    }
}

async function getGroupAnywhere(groupId) {
    // Try groups table first
    const group = await getGroup(groupId);
    if (group) return group;

    // Fall back to images table
    try {
        const [rows] = await pool.execute(`SELECT * FROM images WHERE imageId = ?`, [groupId]);
        if (rows.length > 0) {
            return transformLegacyToGroup(rows[0]);
        }
    } catch (error) {
        console.warn(`[getGroupAnywhere] Failed to check legacy images for ${groupId}:`, error);
    }
    return null;
}

async function deleteGroupAnywhere(groupId) {
    // Try deleting from groups table
    try {
        await deleteGroup(groupId);
    } catch (error) {
        console.warn(`[deleteGroupAnywhere] Failed to delete from groups table:`, error);
    }

    // Also attempt deletion from images table
    try {
        await pool.execute(`DELETE FROM images WHERE imageId = ?`, [groupId]);
    } catch (error) {
        console.error(`[deleteGroupAnywhere] Failed to delete from images table:`, error);
        throw new Error(`Failed to delete legacy record: ${error.message}`);
    }
}

module.exports = {
    createGroup,
    getGroup,
    getGroupAnywhere,
    queryGroupsByUserId,
    updateGroupStatus,
    updateGroupAnalysis,
    updateGroupAnalysisAndStatus,
    addGroupError,
    deleteGroup,
    deleteGroupAnywhere,
    transformLegacyToGroup,
};
