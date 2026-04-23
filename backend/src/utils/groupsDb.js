/**
 * DynamoDB operations for Groups_Table (ai-bharat-groups)
 * 
 * Provides functions to:
 * - Insert new group records with status "pending"
 * - Update group with analysisResult
 * - Update group status
 * - Query groups by userId using GSI
 * - Get group by groupId
 * 
 * Validates: Requirements 5.3, 5.5, 5.7, 5.8, 6.2
 */

const { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("./dynamodb");

const GROUPS_TABLE = process.env.GROUPS_TABLE || "ai-bharat-groups";
const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";
const USER_ID_INDEX = "userId-createdAt-index";

/**
 * Transform a legacy single-image record to group format
 */
function transformLegacyToGroup(legacyRecord) {
    if (!legacyRecord) return null;
    let primarySpecies = null;
    let totalFishCount = 0;
    let transformedAnalysis = null;

    if (legacyRecord.analysisResult) {
        const ar = legacyRecord.analysisResult;
        primarySpecies = ar.species;

        // Handle multi-fish offline records (allDetections array)
        const dets = ar.allDetections || [];
        totalFishCount = dets.length || 1;

        // Build per-fish crops map from allDetections if available
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
            // Fallback for truly legacy records with no allDetections
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

        // Map legacy flat analysis to modern GroupAnalysis structure
        transformedAnalysis = {
            images: [
                {
                    imageIndex: 0,
                    s3Key: legacyRecord.s3Key,
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
        // Carry over weight estimates and location data
        ...(legacyRecord.weightEstimates && { weightEstimates: legacyRecord.weightEstimates }),
        ...(legacyRecord.latitude !== undefined && { latitude: legacyRecord.latitude }),
        ...(legacyRecord.longitude !== undefined && { longitude: legacyRecord.longitude }),
        ...(legacyRecord.locationMapped !== undefined && { locationMapped: legacyRecord.locationMapped }),
        ...(legacyRecord.locationMapReason && { locationMapReason: legacyRecord.locationMapReason }),
    };
}

/**
 * Insert a new group record with status "pending"
 * 
 * @param {Object} groupData - Group data to insert
 * @param {string} groupData.groupId - Unique group identifier (UUID)
 * @param {string} groupData.userId - User ID from Cognito
 * @param {number} groupData.imageCount - Number of images in the group
 * @param {string[]} groupData.s3Keys - Array of S3 keys for all images
 * @param {number} [groupData.latitude] - Optional latitude coordinate
 * @param {number} [groupData.longitude] - Optional longitude coordinate
 * @param {boolean} [groupData.locationMapped] - Optional location mapping status
 * @param {string} [groupData.locationMapReason] - Optional location mapping reason
 * @returns {Promise<Object>} The created group record
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 2.4, 5.3, 5.4
 */
async function createGroup(groupData) {
    const now = new Date().toISOString();
    
    const item = {
        groupId: groupData.groupId,
        userId: groupData.userId,
        imageCount: groupData.imageCount,
        s3Keys: groupData.s3Keys,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        ...(groupData.latitude !== undefined && { latitude: groupData.latitude }),
        ...(groupData.longitude !== undefined && { longitude: groupData.longitude }),
        ...(groupData.locationMapped !== undefined && { locationMapped: groupData.locationMapped }),
        ...(groupData.locationMapReason && { locationMapReason: groupData.locationMapReason }),
    };

    try {
        await ddb.send(
            new PutCommand({
                TableName: GROUPS_TABLE,
                Item: item,
            })
        );
        return item;
    } catch (error) {
        console.error("Error creating group:", error);
        throw new Error(`Failed to create group: ${error.message}`);
    }
}

/**
 * Get a group record by groupId
 * 
 * @param {string} groupId - The group identifier
 * @returns {Promise<Object|null>} The group record or null if not found
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.7
 */
async function getGroup(groupId) {
    try {
        const result = await ddb.send(
            new GetCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
            })
        );
        return result.Item || null;
    } catch (error) {
        console.error("Error getting group:", error);
        throw new Error(`Failed to get group: ${error.message}`);
    }
}

/**
 * Query groups by userId using GSI, sorted by createdAt descending
 * 
 * @param {string} userId - The user identifier
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=20] - Maximum number of items to return
 * @param {Object} [options.lastKey] - Pagination token from previous query
 * @returns {Promise<Object>} Object with items array and optional lastKey
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 6.2, 6.3, 6.4
 */
async function queryGroupsByUserId(userId, options = {}) {
    const { limit = 20, lastKey } = options;

    try {
        const params = {
            TableName: GROUPS_TABLE,
            IndexName: USER_ID_INDEX,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId,
            },
            ScanIndexForward: false, // Sort by createdAt descending (newest first)
            Limit: limit,
        };

        if (lastKey) {
            params.ExclusiveStartKey = lastKey;
        }

        const result = await ddb.send(new QueryCommand(params));

        return {
            items: result.Items || [],
            lastKey: result.LastEvaluatedKey,
        };
    } catch (error) {
        console.error("Error querying groups by userId:", error);
        throw new Error(`Failed to query groups: ${error.message}`);
    }
}

/**
 * Update group status
 * 
 * @param {string} groupId - The group identifier
 * @param {string} status - New status ("pending" | "processing" | "completed" | "partial" | "failed")
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.7, 5.8
 */
async function updateGroupStatus(groupId, status) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":status": status,
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error updating group status:", error);
        throw new Error(`Failed to update group status: ${error.message}`);
    }
}

/**
 * Update group with analysis result
 * 
 * @param {string} groupId - The group identifier
 * @param {Object} analysisResult - The complete group analysis result
 * @param {Array} analysisResult.images - Array of image analysis results
 * @param {Object} analysisResult.aggregateStats - Aggregate statistics
 * @param {string} analysisResult.processedAt - ISO 8601 timestamp
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.5, 5.6
 */
async function updateGroupAnalysis(groupId, analysisResult) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET analysisResult = :analysisResult, updatedAt = :updatedAt",
                ExpressionAttributeValues: {
                    ":analysisResult": analysisResult,
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error updating group analysis:", error);
        throw new Error(`Failed to update group analysis: ${error.message}`);
    }
}

/**
 * Update group with both analysis result and status
 * Convenience function to update both fields atomically
 * 
 * @param {string} groupId - The group identifier
 * @param {Object} analysisResult - The complete group analysis result
 * @param {string} status - New status ("completed" | "partial" | "failed")
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.5, 5.7, 5.8
 */
async function updateGroupAnalysisAndStatus(groupId, analysisResult, status) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET analysisResult = :analysisResult, #status = :status, updatedAt = :updatedAt",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":analysisResult": analysisResult,
                    ":status": status,
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error updating group analysis and status:", error);
        throw new Error(`Failed to update group analysis and status: ${error.message}`);
    }
}

/**
 * Add error information for a failed image
 * 
 * @param {string} groupId - The group identifier
 * @param {Object} errorInfo - Error information
 * @param {number} errorInfo.imageIndex - Index of the failed image
 * @param {string} errorInfo.error - Error message
 * @param {string} errorInfo.timestamp - ISO 8601 timestamp
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 */
async function addGroupError(groupId, errorInfo) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET errors = list_append(if_not_exists(errors, :emptyList), :errorInfo), updatedAt = :updatedAt",
                ExpressionAttributeValues: {
                    ":errorInfo": [errorInfo],
                    ":emptyList": [],
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error adding group error:", error);
        throw new Error(`Failed to add group error: ${error.message}`);
    }
}

/**
 * Delete a group record by groupId
 * 
 * @param {string} groupId - The group identifier
 * @returns {Promise<void>}
 * @throws {Error} If DynamoDB operation fails
 */
async function deleteGroup(groupId) {
    try {
        await ddb.send(
            new DeleteCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
            })
        );
    } catch (error) {
        console.error("Error deleting group:", error);
        throw new Error(`Failed to delete group: ${error.message}`);
    }
}

/**
 * Get a group, falling back to legacy images table if not found in groups table
 */
async function getGroupAnywhere(groupId) {
    // Try groups table first
    const group = await getGroup(groupId);
    if (group) return group;

    // Fall back to images table (where imageId = groupId in merged history)
    try {
        const result = await ddb.send(
            new GetCommand({
                TableName: IMAGES_TABLE,
                Key: { imageId: groupId },
            })
        );
        if (result.Item) {
            return transformLegacyToGroup(result.Item);
        }
    } catch (error) {
        console.warn(`[getGroupAnywhere] Failed to check legacy images for ${groupId}:`, error);
    }
    return null;
}

/**
 * Delete a group from whichever table it exists in
 */
async function deleteGroupAnywhere(groupId) {
    // Try deleting from groups table
    try {
        await deleteGroup(groupId);
    } catch (error) {
        console.warn(`[deleteGroupAnywhere] Failed to delete from groups table (might be legacy):`, error);
    }

    // Also attempt deletion from images table
    try {
        await ddb.send(
            new DeleteCommand({
                TableName: IMAGES_TABLE,
                Key: { imageId: groupId },
            })
        );
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
