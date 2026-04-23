/**
 * Lambda: GET /user/public/:slug
 *
 * Fetches a public user profile by slug. No authentication required.
 * Only returns data if publicProfileEnabled is true.
 * If showPublicStats is true, also computes basic catch stats.
 */
const { ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { ddb } = require("../utils/dynamodb");
const { s3 } = require("../utils/s3");
const { ok, notFound, serverError } = require("../utils/response");

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "";
const GROUPS_TABLE = process.env.GROUPS_TABLE || "";
const BUCKET = process.env.S3_BUCKET_NAME;

async function resolveAvatarUrl(avatar) {
    if (!avatar || !BUCKET) return avatar || "";
    const cleanUrl = avatar.split("?")[0];
    const s3Prefix = `https://${BUCKET}.s3.amazonaws.com/`;
    if (!cleanUrl.startsWith(s3Prefix)) return avatar;
    const s3Key = cleanUrl.replace(s3Prefix, "");
    try {
        const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
        return await getSignedUrl(s3, command, { expiresIn: 3600 });
    } catch {
        return "";
    }
}

async function fetchPublicStats(userId) {
    try {
        const result = await ddb.send(
            new QueryCommand({
                TableName: GROUPS_TABLE,
                IndexName: "userId-createdAt-index",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false,
            })
        );
        const groups = result.Items || [];
        const completedGroups = groups.filter(g => g.status === "completed");

        let totalFish = 0;
        const speciesSet = new Set();
        let lastCatchDate = "";

        for (const g of completedGroups) {
            const stats = g.analysisResult?.aggregateStats;
            if (stats) {
                totalFish += stats.totalFishCount || 0;
                if (stats.speciesDistribution) {
                    for (const sp of Object.keys(stats.speciesDistribution)) {
                        speciesSet.add(sp);
                    }
                }
            }
            if (!lastCatchDate || g.createdAt > lastCatchDate) {
                lastCatchDate = g.createdAt;
            }
        }

        return {
            totalGroups: completedGroups.length,
            totalFish,
            uniqueSpecies: speciesSet.size,
            lastCatchDate,
        };
    } catch (err) {
        console.error("fetchPublicStats error:", err);
        return null;
    }
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    // Extract slug from path: /user/public/{slug}
    const slug = event.pathParameters?.slug
        || (event.path && event.path.split("/").pop())
        || "";

    if (!slug) return notFound("Profile not found");

    try {
        // Scan for matching slug
        const result = await ddb.send(
            new ScanCommand({
                TableName: USERS_TABLE,
                FilterExpression: "publicProfileSlug = :slug AND publicProfileEnabled = :enabled",
                ExpressionAttributeValues: {
                    ":slug": slug,
                    ":enabled": true,
                }
            })
        );

        const items = result.Items || [];
        if (items.length === 0) {
            return notFound("Profile not found or is private");
        }

        const user = items[0];

        // Only expose safe public fields
        const publicProfile = {
            name: user.name || "",
            avatar: await resolveAvatarUrl(user.avatar),
            port: user.port || "",
            customPort: user.customPort || "",
            region: user.region || "",
            role: user.role || "fisherman",
            publicProfileSlug: user.publicProfileSlug,
            createdAt: user.createdAt || "",
            showPublicStats: user.showPublicStats ?? false,
        };

        // If user opted in to showing stats, fetch them
        if (user.showPublicStats && user.userId) {
            publicProfile.stats = await fetchPublicStats(user.userId);
        }

        return ok({ profile: publicProfile });
    } catch (err) {
        console.error("getPublicProfile error:", err);
        return serverError("Failed to fetch public profile");
    }
};
