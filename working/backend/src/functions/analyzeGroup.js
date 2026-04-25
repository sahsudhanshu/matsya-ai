/**
 * Lambda: POST /groups/:groupId/analyze
 *
 * Triggers concurrent ML analysis for all images in a group.
 * Processes all images in parallel using Promise.all(), combines results,
 * and updates the group record with complete analysis.
 *
 * Validates: Requirements 12.3, 12.7, 12.8, 4.8, 5.7, 5.8
 */

const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, notFound, serverError } = require("../utils/response");
const { getGroup, updateGroupStatus, updateGroupAnalysisAndStatus } = require("../utils/groupsDb");
const { processImagesAsync } = require("../utils/mlApi");
const { combineMLResponses } = require("../utils/groupAnalysis");

/**
 * Validate groupId format (UUID)
 * 
 * @param {string} groupId - The group identifier to validate
 * @returns {boolean} True if valid UUID format
 */
function isValidGroupId(groupId) {
    if (!groupId || typeof groupId !== "string") {
        return false;
    }
    
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(groupId);
}

/**
 * Determine final group status based on analysis results
 * 
 * @param {Array} images - Array of image analysis results
 * @returns {string} Status: "completed", "partial", or "failed"
 */
function determineGroupStatus(images) {
    const successCount = images.filter(img => !img.error).length;
    const totalCount = images.length;
    
    if (successCount === 0) {
        return "failed";
    } else if (successCount < totalCount) {
        return "partial";
    } else {
        return "completed";
    }
}

/**
 * Lambda handler for POST /groups/:groupId/analyze
 * 
 * Orchestrates concurrent ML analysis for all images in a group
 * 
 * @param {Object} event - API Gateway Lambda Proxy event
 * @returns {Object} API Gateway Lambda Proxy response
 */
exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") return ok({});

    // Extract userId from JWT token
    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch (err) {
        console.error("Authentication failed:", err);
        return unauthorized("Invalid or missing authentication token");
    }

    const userId = decoded.sub;

    // Extract and validate groupId parameter
    const groupId = event.pathParameters?.groupId;
    
    if (!groupId) {
        return badRequest("groupId path parameter is required");
    }
    
    if (!isValidGroupId(groupId)) {
        return badRequest("Invalid groupId format");
    }

    // Retrieve group record from DynamoDB
    let group;
    try {
        group = await getGroup(groupId);
        
        if (!group) {
            return notFound("Group not found");
        }
    } catch (err) {
        console.error("Error retrieving group:", err);
        return serverError("Failed to retrieve group record");
    }

    // Verify user owns the group (userId match)
    if (group.userId !== userId) {
        return unauthorized("Access denied: You do not own this group");
    }

    // Update group status to "processing"
    try {
        await updateGroupStatus(groupId, "processing");
    } catch (err) {
        console.error("Error updating group status to processing:", err);
        return serverError("Failed to update group status");
    }

    try {
        // Retrieve all s3Keys from group record
        const s3Keys = group.s3Keys || [];
        
        if (s3Keys.length === 0) {
            throw new Error("No images found in group");
        }

        // Call concurrent ML processing service
        console.log(`Processing ${s3Keys.length} images concurrently for group ${groupId}`);
        const mlResults = await processImagesAsync(s3Keys);

        // Combine results into Group_Analysis
        const groupAnalysis = combineMLResponses(mlResults);

        // Determine final status based on results
        const finalStatus = determineGroupStatus(groupAnalysis.images);

        // Update group record with analysisResult and status
        await updateGroupAnalysisAndStatus(groupId, groupAnalysis, finalStatus);

        console.log(`Group ${groupId} analysis completed with status: ${finalStatus}`);

        // Return complete Group_Analysis response
        return ok({
            groupId,
            status: finalStatus,
            analysisResult: groupAnalysis,
        });
    } catch (err) {
        console.error("Error during group analysis:", err);
        
        // Update status to "failed" on error
        try {
            await updateGroupStatus(groupId, "failed");
        } catch (updateErr) {
            console.error("Error updating group status to failed:", updateErr);
        }
        
        return serverError("ML analysis failed. Please try again.");
    }
};
