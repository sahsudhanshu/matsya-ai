/**
 * Lambda: GET /user/profile
 *
 * Fetches the authenticated user's profile from the ai-bharat-users table.
 * If the avatar is an S3 URL, generates a presigned GET URL so the
 * browser can display it (S3 objects are private by default).
 */
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { pool } = require("../utils/db");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * If avatar is an S3 URL from our bucket, generate a presigned GET URL.
 * Otherwise return it as-is.
 */
async function resolveAvatarUrl(avatar) {
    if (!avatar || !BUCKET) return avatar || "";

    // Strip cache-busting query params
    const cleanUrl = avatar.split("?")[0];

    // Check if it's our S3 bucket URL
    const s3Prefix = `https://${BUCKET}.s3.amazonaws.com/`;
    if (!cleanUrl.startsWith(s3Prefix)) return avatar;

    const s3Key = cleanUrl.replace(s3Prefix, "");
    try {
        const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
        return await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
    } catch (err) {
        console.error("Failed to generate avatar presigned URL:", err);
        return "";
    }
}

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
        const [rows] = await pool.execute(`SELECT * FROM users WHERE userId = ?`, [userId]);

        if (rows.length === 0) {
            // User does not exist in MySQL yet (first login after Cognito signup).
            // Auto-insert them so the table is populated.
            const now = new Date().toISOString();
            const defaultProfile = {
                userId,
                email: decoded.email || `${userId}@placeholder.com`,
                name: "Fisherman",
                phone: "",
                avatar: "",
                port: "",
                customPort: "",
                region: "",
                role: "fisherman",
                publicProfileEnabled: 0,
                publicProfileSlug: "",
                preferences: JSON.stringify({
                    language: "english",
                    notifications: true,
                    offlineSync: true,
                    units: "kg",
                    boatType: "",
                }),
                createdAt: now,
                updatedAt: now,
            };

            await pool.execute(
                `INSERT INTO users (userId, email, name, avatar, port, customPort, region, role, publicProfileEnabled, publicProfileSlug, preferences, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    defaultProfile.userId, defaultProfile.email, defaultProfile.name, defaultProfile.avatar,
                    defaultProfile.port, defaultProfile.customPort, defaultProfile.region, defaultProfile.role,
                    defaultProfile.publicProfileEnabled, defaultProfile.publicProfileSlug, defaultProfile.preferences,
                    defaultProfile.createdAt, defaultProfile.updatedAt
                ]
            );

            // Parse preferences back to object for the frontend response
            defaultProfile.preferences = JSON.parse(defaultProfile.preferences);
            defaultProfile.publicProfileEnabled = false;

            return ok({ profile: defaultProfile });
        }

        // Resolve avatar to a presigned GET URL
        const profile = { ...rows[0] };
        
        // Parse preferences if it's stored as JSON in MySQL (if I made a JSON column, but let's parse safely)
        if (typeof profile.preferences === 'string') {
            profile.preferences = JSON.parse(profile.preferences);
        }

        profile.publicProfileEnabled = !!profile.publicProfileEnabled;

        profile.avatar = await resolveAvatarUrl(profile.avatar);

        return ok({ profile });
    } catch (err) {
        console.error("getUserProfile error:", err);
        return serverError("Failed to fetch user profile");
    }
};
