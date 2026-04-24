/**
 * Lambda: POST /groups/presigned-urls
 *
 * Generates multiple S3 presigned URLs for group-based multi-image upload.
 * Creates initial group record in DynamoDB with "pending" status.
 *
 * Body: { 
 *   files: [{ fileName: string, fileType: string }], 
 *   latitude?: number, 
 *   longitude?: number 
 * }
 * Returns: { 
 *   groupId, 
 *   presignedUrls: [{ uploadUrl, s3Key, index }], 
 *   locationMapped, 
 *   locationMapReason? 
 * }
 * 
 * Validates: Requirements 12.1, 12.2, 12.6
 */

const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");
const { generateMultiplePresignedUrls } = require("../utils/groupS3");
const { createGroup } = require("../utils/groupsDb");

const WATER_KEYWORDS = ["sea", "ocean", "bay", "gulf", "channel", "strait", "coast"];
const LAND_ADDRESS_KEYS = ["city", "town", "village", "hamlet", "road", "suburb", "postcode", "county", "state_district"];

/**
 * Detect if coordinates are in ocean using OpenStreetMap Nominatim API
 * Reuses logic from getPresignedUrl.js for consistency
 * 
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<Object>} Object with isOcean boolean and reason string
 */
async function detectOceanLocation(latitude, longitude) {
    if (latitude == null || longitude == null) {
        return { isOcean: false, reason: "location_not_provided" };
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { isOcean: false, reason: "location_invalid" };
    }

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "matsya AI/1.0 (AI-for-Bharat)",
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            return { isOcean: false, reason: "location_validation_unavailable" };
        }

        const data = await response.json();
        const displayName = String(data?.display_name || "").toLowerCase();
        const category = String(data?.category || "").toLowerCase();
        const type = String(data?.type || "").toLowerCase();
        const address = data?.address || {};

        const looksWater = WATER_KEYWORDS.some((k) =>
            displayName.includes(k) || category.includes(k) || type.includes(k)
        );
        const hasLandHints = LAND_ADDRESS_KEYS.some((k) => address[k]);

        if (looksWater && !hasLandHints) {
            return { isOcean: true, reason: "ocean_detected" };
        }

        return { isOcean: false, reason: "location_not_in_ocean" };
    } catch {
        return { isOcean: false, reason: "location_validation_unavailable" };
    }
}

/**
 * Lambda handler for POST /groups/presigned-urls
 * 
 * Validates request body, generates presigned URLs, and creates group record
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

    // Parse request body
    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch (err) {
        return badRequest("Invalid JSON body");
    }

    const { files, latitude, longitude } = body;

    // Validate request body contains files array
    if (!files || !Array.isArray(files)) {
        return badRequest("files array is required");
    }

    if (files.length === 0) {
        return badRequest("files array cannot be empty");
    }

    // Validate each file has fileName and fileType
    const allowedTypes = ["image/jpeg", "image/png", "image/heic", "image/webp"];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!file.fileName || typeof file.fileName !== "string") {
            return badRequest(`files[${i}].fileName is required and must be a string`);
        }
        
        if (!file.fileType || typeof file.fileType !== "string") {
            return badRequest(`files[${i}].fileType is required and must be a string`);
        }
        
        if (!allowedTypes.includes(file.fileType)) {
            return badRequest(`files[${i}].fileType must be one of: ${allowedTypes.join(", ")}`);
        }
    }

    // Detect ocean location if coordinates provided
    const locationCheck = await detectOceanLocation(latitude, longitude);
    const mappedLatitude = locationCheck.isOcean ? Number(latitude) : null;
    const mappedLongitude = locationCheck.isOcean ? Number(longitude) : null;

    try {
        // Call presigned URL generation service
        const { groupId, presignedUrls } = await generateMultiplePresignedUrls({
            userId,
            files,
        });

        // Extract s3Keys from presigned URLs
        const s3Keys = presignedUrls.map(url => url.s3Key);

        // Create initial group record in DynamoDB
        await createGroup({
            groupId,
            userId,
            imageCount: files.length,
            s3Keys,
            latitude: mappedLatitude,
            longitude: mappedLongitude,
            locationMapped: locationCheck.isOcean,
            locationMapReason: locationCheck.reason,
        });

        // Return groupId and presigned URLs array
        return ok({
            groupId,
            presignedUrls,
            locationMapped: locationCheck.isOcean,
            locationMapReason: locationCheck.reason,
        });
    } catch (err) {
        console.error("Error creating group presigned URLs:", err);
        return serverError("Failed to generate presigned URLs or create group record");
    }
};
