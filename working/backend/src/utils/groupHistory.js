/**
 * Group history service for querying and merging group and legacy image records
 */

const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { pool } = require("./db");
const { s3 } = require("./s3");
const { transformLegacyToGroup, queryGroupsByUserId } = require("./groupsDb");

const BUCKET = process.env.S3_BUCKET_NAME;
const URL_EXPIRY_SECONDS = 3600; // 1 hour for viewing

/**
 * Query legacy images table by userId
 */
async function queryLegacyImages(userId, options = {}) {
    const limit = parseInt(options.limit, 10) || 20;

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM images WHERE userId = ? ORDER BY createdAt DESC LIMIT ${limit}`,
            [userId]
        );
        return rows.map(item => {
            if (item.analysisResult && typeof item.analysisResult === 'string') {
                item.analysisResult = JSON.parse(item.analysisResult);
            }
            return item;
        });
    } catch (error) {
        console.error("Error querying legacy images:", error);
        throw new Error(`Failed to query legacy images: ${error.message}`);
    }
}


/**
 * Query and merge group history from both Groups_Table and legacy images table
 * 
 * @param {string} userId - The user identifier
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=20] - Maximum number of items to return
 * @returns {Promise<Object>} Object with items array and optional lastKey
 * 
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5
 */
async function getMergedHistory(userId, options = {}) {
    const limit = parseInt(options.limit, 10) || 20;

    try {
        // Query both tables concurrently - treat each source as optional so a
        // timeout on one source doesn't kill the entire response.
        const [groupsSettled, legacySettled] = await Promise.allSettled([
            queryGroupsByUserId(userId, { limit }),
            queryLegacyImages(userId, { limit }),
        ]);

        if (groupsSettled.status === "rejected") {
            console.error("[getMergedHistory] groups query failed:", groupsSettled.reason);
        }
        if (legacySettled.status === "rejected") {
            console.error("[getMergedHistory] legacy images query failed:", legacySettled.reason);
        }

        const groupsResult = groupsSettled.status === "fulfilled"
            ? groupsSettled.value
            : { items: [], lastKey: undefined };

        const legacyImages = legacySettled.status === "fulfilled"
            ? legacySettled.value
            : [];

        // Transform legacy records to group format
        const transformedLegacy = legacyImages.map(transformLegacyToGroup);

        // Merge both sources
        const merged = [...groupsResult.items, ...transformedLegacy];

        // Sort by createdAt descending (newest first)
        merged.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
        });

        // Apply limit to merged results
        const items = merged.slice(0, limit);

        // Generate presigned URLs for thumbnails (up to 3 images per group)
        const itemsWithThumbnails = await Promise.all(items.map(async (item) => {
            let keysToSign = [];
            if (item.s3Keys && item.s3Keys.length > 0) {
                keysToSign = item.s3Keys.slice(0, 3);
            }

            const presignedViewUrls = await Promise.all(
                keysToSign.map(async (s3Key) => {
                    const command = new GetObjectCommand({
                        Bucket: BUCKET,
                        Key: s3Key,
                    });
                    return getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });
                })
            ).catch(() => []); // Fail silently if S3 issues arise

            return {
                ...item,
                presignedViewUrls
            };
        }));

        return {
            items: itemsWithThumbnails,
            // Note: Pagination with lastKey is complex with merged sources
            // For MVP, we return up to limit items without pagination token
            lastKey: groupsResult.lastKey,
        };
    } catch (error) {
        console.error("Error getting merged history:", error);
        throw new Error(`Failed to get merged history: ${error.message}`);
    }
}

module.exports = {
    queryLegacyImages,
    transformLegacyToGroup,
    getMergedHistory,
};
