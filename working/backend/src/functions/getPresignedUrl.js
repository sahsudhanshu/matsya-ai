/**
 * Lambda: POST /images/presigned-url
 *
 * Generates an S3 presigned URL for direct client-side upload.
 * Saves initial image metadata to MySQL with "pending" status.
 *
 * Body: { fileName: string, fileType: string, latitude?: number, longitude?: number }
 * Returns: { uploadUrl, imageId, s3Path }
 */
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../utils/db");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const BUCKET = process.env.S3_BUCKET_NAME;
const URL_EXPIRY_SECONDS = 300; // 5 minutes

const WATER_KEYWORDS = ["sea", "ocean", "bay", "gulf", "channel", "strait", "coast"];
const LAND_ADDRESS_KEYS = ["city", "town", "village", "hamlet", "road", "suburb", "postcode", "county", "state_district"];

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

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch {
        return badRequest("Invalid JSON body");
    }

    const { fileName, fileType, latitude, longitude } = body;

    if (!fileName || !fileType) {
        return badRequest("fileName and fileType are required");
    }

    // Validate mime type
    const allowedTypes = ["image/jpeg", "image/png", "image/heic", "image/webp"];
    if (!allowedTypes.includes(fileType)) {
        return badRequest(`Unsupported file type: ${fileType}`);
    }

    const locationCheck = await detectOceanLocation(latitude, longitude);
    const isValid = locationCheck.reason !== "location_invalid" && locationCheck.reason !== "location_not_provided";
    const mappedLatitude = isValid ? Number(latitude) : null;
    const mappedLongitude = isValid ? Number(longitude) : null;

    const imageId = uuidv4();
    const userId = decoded.sub;
    const ext = fileName.split(".").pop() || "jpg";
    const s3Key = `uploads/${userId}/${imageId}.${ext}`;
    const createdAt = new Date().toISOString();

    try {
        // 1. Generate presigned URL
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            ContentType: fileType,
            Metadata: { userId, imageId },
        });
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });

        // 2. Save initial metadata to MySQL
        await pool.execute(
            `INSERT INTO images (imageId, userId, s3Path, s3Key, latitude, longitude, locationMapped, locationMapReason, status, analysisResult, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
            [
                imageId,
                userId,
                `s3://${BUCKET}/${s3Key}`,
                s3Key,
                mappedLatitude,
                mappedLongitude,
                locationCheck.isOcean ? 1 : 0,
                locationCheck.reason,
                createdAt,
                createdAt,
            ]
        );

        return ok({
            uploadUrl,
            imageId,
            s3Path: `s3://${BUCKET}/${s3Key}`,
            locationMapped: locationCheck.isOcean,
            locationMapReason: locationCheck.reason,
        });
    } catch (err) {
        console.error("getPresignedUrl error:", err);
        return serverError("Failed to generate upload URL");
    }
};
