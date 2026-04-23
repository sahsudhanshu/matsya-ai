/**
 * Lambda: PUT /user/profile
 *
 * Updates the authenticated user's profile in the ai-bharat-users table.
 * Also supports generating a presigned URL for avatar upload when
 * avatarFileName and avatarFileType are provided.
 *
 * Body (all optional):
 *   name, phone, port, region, role, avatar (S3 URL string),
 *   preferences: { language, notifications, offlineSync, units, boatType },
 *   avatarFileName, avatarFileType  (triggers presigned URL generation)
 *
 * Returns: { profile, avatarUploadUrl? }
 */
const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { ddb } = require("../utils/dynamodb");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "";
const BUCKET = process.env.S3_BUCKET_NAME;

// Fields the user is allowed to update
const ALLOWED_FIELDS = ["name", "email", "phone", "port", "customPort", "region", "role", "avatar", "preferences", "publicProfileEnabled", "publicProfileSlug", "showPublicStats"];

exports.handler = async (event) => {
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

    const userId = decoded.sub;
    const now = new Date().toISOString();

    try {
        // ── Avatar presigned URL (optional) ──────────────────────────────
        let avatarUploadUrl = null;
        let avatarS3Url = null;

        if (body.avatarFileName && body.avatarFileType) {
            const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
            if (!allowedTypes.includes(body.avatarFileType)) {
                return badRequest(`Unsupported avatar file type: ${body.avatarFileType}`);
            }

            const ext = body.avatarFileName.split(".").pop() || "jpg";
            const s3Key = `avatars/${userId}/profile.${ext}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
                ContentType: body.avatarFileType,
                Metadata: { userId },
            });
            avatarUploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
            avatarS3Url = `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;

            // Auto-set avatar field to the S3 URL
            body.avatar = avatarS3Url;
        }

        // ── Build update expression ──────────────────────────────────────
        const updateParts = [];
        const expressionNames = {};
        const expressionValues = {};

        for (const field of ALLOWED_FIELDS) {
            if (body[field] !== undefined) {
                const safeKey = `#${field}`;
                const safeVal = `:${field}`;
                updateParts.push(`${safeKey} = ${safeVal}`);
                expressionNames[safeKey] = field;
                expressionValues[safeVal] = body[field];
            }
        }

        // Always update timestamps
        updateParts.push("#updatedAt = :updatedAt");
        expressionNames["#updatedAt"] = "updatedAt";
        expressionValues[":updatedAt"] = now;

        if (updateParts.length === 0) {
            return badRequest("No valid fields to update");
        }

        const updateExpression = `SET ${updateParts.join(", ")}`;

        await ddb.send(
            new UpdateCommand({
                TableName: USERS_TABLE,
                Key: { userId },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: expressionNames,
                ExpressionAttributeValues: expressionValues,
            })
        );

        // Fetch updated profile to return
        const updated = await ddb.send(
            new GetCommand({
                TableName: USERS_TABLE,
                Key: { userId },
            })
        );

        const response = { profile: updated.Item || {} };
        if (avatarUploadUrl) {
            response.avatarUploadUrl = avatarUploadUrl;
            response.avatarS3Url = avatarS3Url;
        }

        return ok(response);
    } catch (err) {
        console.error("updateUserProfile error:", err);
        return serverError("Failed to update user profile");
    }
};
