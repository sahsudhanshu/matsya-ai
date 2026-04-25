/**
 * Lambda: GET /groups/:groupId
 *
 * Returns complete group details including all images and analysis results.
 * Generates presigned GET URLs for viewing original images.
 * 
 * Validates: Requirements 12.5, 12.7, 12.8
 */
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, notFound, serverError, badRequest } = require("../utils/response");
const { getGroupAnywhere } = require("../utils/groupsDb");
const { s3 } = require("../utils/s3");

const BUCKET = process.env.S3_BUCKET_NAME;
const URL_EXPIRY_SECONDS = 3600; // 1 hour for viewing

const S3_URL_PREFIX = `https://${BUCKET}.s3.amazonaws.com/`;

/**
 * Generate presigned GET URLs for viewing images
 * 
 * @param {string[]} s3Keys - Array of S3 keys
 * @returns {Promise<string[]>} Array of presigned GET URLs
 */
async function generatePresignedViewUrls(s3Keys) {
    return Promise.all(
        s3Keys.map(async (s3Key) => {
            const command = new GetObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
            });
            return getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });
        })
    );
}

/**
 * Convert an S3 URL to a presigned GET URL.
 * Returns the original URL unchanged if it's not an S3 URL from our bucket.
 */
async function resolveS3Url(url) {
    if (!url || !url.startsWith(S3_URL_PREFIX)) return url;
    const s3Key = url.slice(S3_URL_PREFIX.length);
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
    return getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });
}

/**
 * Walk through analysisResult and resolve any S3 URLs in crop_url and gradcam_url
 * fields to presigned GET URLs so the client can display them.
 */
async function resolveAnalysisS3Urls(analysisResult) {
    if (!analysisResult?.images) return analysisResult;
    const resolved = { ...analysisResult, images: [...analysisResult.images] };
    for (let i = 0; i < resolved.images.length; i++) {
        const img = resolved.images[i];
        if (!img.crops) continue;
        const newCrops = { ...img.crops };
        for (const key of Object.keys(newCrops)) {
            const crop = { ...newCrops[key] };
            crop.crop_url = await resolveS3Url(crop.crop_url);
            if (crop.species) crop.species = { ...crop.species, gradcam_url: await resolveS3Url(crop.species.gradcam_url) };
            if (crop.disease) crop.disease = { ...crop.disease, gradcam_url: await resolveS3Url(crop.disease.gradcam_url) };
            newCrops[key] = crop;
        }
        resolved.images[i] = { ...img, crops: newCrops };
    }
    // Also resolve S3 URLs in the detections array (present in legacy-transformed records)
    if (resolved.detections) {
        resolved.detections = await Promise.all(resolved.detections.map(async (d) => ({
            ...d,
            cropUrl: await resolveS3Url(d.cropUrl),
            gradcamUrls: d.gradcamUrls ? {
                ...d.gradcamUrls,
                species: await resolveS3Url(d.gradcamUrls.species),
                disease: await resolveS3Url(d.gradcamUrls.disease),
            } : d.gradcamUrls,
        })));
    }
    return resolved;
}

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
    const groupId = event.pathParameters?.groupId;

    if (!groupId) {
        return badRequest("groupId path parameter is required");
    }

    try {
        // Get group record from DynamoDB (checking both tables)
        const group = await getGroupAnywhere(groupId);

        if (!group) {
            return notFound("Group not found");
        }

        // Verify user owns the group
        if (group.userId !== userId) {
            return unauthorized("Access denied");
        }

        // Generate presigned GET URLs for viewing original images
        const presignedViewUrls = await generatePresignedViewUrls(group.s3Keys || []);

        // Resolve any S3 URLs in crop/gradcam fields to presigned GET URLs
        const analysisResult = await resolveAnalysisS3Urls(group.analysisResult);

        // Return complete group details
        return ok({
            groupId: group.groupId,
            userId: group.userId,
            imageCount: group.imageCount,
            status: group.status,
            s3Keys: group.s3Keys,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            analysisResult,
            presignedViewUrls,
            // Include weight estimates if available
            ...(group.weightEstimates && { weightEstimates: group.weightEstimates }),
            // Include location data if available
            ...(group.latitude !== undefined && { latitude: group.latitude }),
            ...(group.longitude !== undefined && { longitude: group.longitude }),
            ...(group.locationMapped !== undefined && { locationMapped: group.locationMapped }),
            ...(group.locationMapReason && { locationMapReason: group.locationMapReason }),
        });
    } catch (err) {
        console.error("getGroupDetails error:", err);
        return serverError("Failed to fetch group details");
    }
};
