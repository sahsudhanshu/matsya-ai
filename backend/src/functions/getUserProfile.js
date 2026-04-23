/**
 * Lambda: GET /user/profile
 *
 * Fetches the authenticated user's profile from the ai-bharat-users table.
 * If the avatar is an S3 URL, generates a presigned GET URL so the
 * browser can display it (S3 objects are private by default).
 */
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { ddb } = require("../utils/dynamodb");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "";
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
        const result = await ddb.send(
            new GetCommand({
                TableName: USERS_TABLE,
                Key: { userId },
            })
        );

        if (!result.Item) {
            return ok({
                profile: {
                    userId,
                    email: "",
                    name: "",
                    phone: "",
                    avatar: "",
                    port: "",
                    customPort: "",
                    region: "",
                    role: "fisherman",
                    publicProfileEnabled: false,
                    publicProfileSlug: "",
                    preferences: {
                        language: "english",
                        notifications: true,
                        offlineSync: true,
                        units: "kg",
                        boatType: "",
                    },
                    createdAt: new Date().toISOString(),
                },
            });
        }

        // Resolve avatar to a presigned GET URL
        const profile = { ...result.Item };
        profile.avatar = await resolveAvatarUrl(profile.avatar);

        return ok({ profile });
    } catch (err) {
        console.error("getUserProfile error:", err);
        return serverError("Failed to fetch user profile");
    }
};
