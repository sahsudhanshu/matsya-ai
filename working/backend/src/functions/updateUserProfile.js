/**
 * Lambda: PUT /user/profile
 *
 * Updates the authenticated user's profile in the users table.
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
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { pool } = require("../utils/db");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const BUCKET = process.env.S3_BUCKET_NAME;

// Fields the user is allowed to update
const ALLOWED_FIELDS = ["name", "email", "port", "customPort", "region", "role", "avatar", "preferences", "publicProfileEnabled", "publicProfileSlug", "showPublicStats"];

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

        // ── Check if user exists, insert if not ──────────────────────────────
        const [existing] = await pool.execute("SELECT userId FROM users WHERE userId = ?", [userId]);
        if (existing.length === 0) {
            // First time profile update -> INSERT
            const insertFields = ["userId", "createdAt"];
            const insertValues = [userId, now];
            const insertPlaceholders = ["?", "?"];
            
            for (const field of ALLOWED_FIELDS) {
                if (body[field] !== undefined) {
                    insertFields.push(`\`${field}\``);
                    let val = body[field];
                    if (typeof val === 'object' && val !== null) {
                        val = JSON.stringify(val);
                    }
                    insertValues.push(val);
                    insertPlaceholders.push("?");
                }
            }
            
            // Note: email is NOT NULL in schema, but we'll try to insert anyway. It might fail if not provided in body or from cognito.
            if (!insertFields.includes("\`email\`")) {
                insertFields.push("\`email\`");
                insertValues.push(decoded.email || `${userId}@placeholder.com`);
                insertPlaceholders.push("?");
            }

            const insertQuery = `INSERT INTO users (${insertFields.join(", ")}) VALUES (${insertPlaceholders.join(", ")})`;
            await pool.execute(insertQuery, insertValues);
        } else {
            // ── Build update expression ──────────────────────────────────────
            const updateParts = [];
            const expressionValues = [];

            for (const field of ALLOWED_FIELDS) {
                if (body[field] !== undefined) {
                    updateParts.push(`\`${field}\` = ?`);
                    let val = body[field];
                    if (typeof val === 'object' && val !== null) {
                        val = JSON.stringify(val);
                    }
                    expressionValues.push(val);
                }
            }

            // Always update timestamps
            updateParts.push("\`updatedAt\` = ?");
            expressionValues.push(now);

            if (updateParts.length > 1) { // >1 because updatedAt is always added
                expressionValues.push(userId);
                const updateExpression = `UPDATE users SET ${updateParts.join(", ")} WHERE userId = ?`;
                await pool.execute(updateExpression, expressionValues);
            }
        }

        // Fetch updated profile to return
        const [rows] = await pool.execute(`SELECT * FROM users WHERE userId = ?`, [userId]);

        const profile = rows[0] || {};
        if (typeof profile.preferences === 'string') {
            profile.preferences = JSON.parse(profile.preferences);
        }

        const response = { profile };
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
