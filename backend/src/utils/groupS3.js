/**
 * S3 operations for group-based multi-image uploads
 * 
 * Provides functions to:
 * - Generate multiple presigned URLs for group uploads
 * - Create S3 keys with groupId prefix
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.5
 */

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const { s3 } = require("./s3");

const BUCKET = process.env.S3_BUCKET_NAME;
const URL_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * Generate multiple presigned URLs for group image uploads
 * 
 * @param {Object} params - Parameters for URL generation
 * @param {string} params.userId - User ID from Cognito
 * @param {Array<Object>} params.files - Array of file metadata
 * @param {string} params.files[].fileName - Original file name
 * @param {string} params.files[].fileType - MIME type (e.g., "image/jpeg")
 * @returns {Promise<Object>} Object containing groupId and presignedUrls array
 * @returns {string} return.groupId - Unique group identifier (UUID)
 * @returns {Array<Object>} return.presignedUrls - Array of presigned URL objects
 * @returns {string} return.presignedUrls[].uploadUrl - Presigned PUT URL
 * @returns {string} return.presignedUrls[].s3Key - S3 key for the image
 * @returns {number} return.presignedUrls[].index - Index of the image in the group
 * @throws {Error} If S3 operation fails
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.5
 */
async function generateMultiplePresignedUrls({ userId, files }) {
    // Generate unique groupId using UUID
    const groupId = uuidv4();
    
    // Generate presigned URLs for all images
    const presignedUrls = await Promise.all(
        files.map(async (file, index) => {
            // Extract file extension from fileName
            const parts = file.fileName.split(".");
            const ext = parts.length > 1 ? parts.pop() : "jpg";
            
            // Create S3 key with groupId prefix: uploads/{userId}/{groupId}_{index}.{ext}
            const s3Key = `uploads/${userId}/${groupId}_${index}.${ext}`;
            
            // Generate presigned PUT URL
            const command = new PutObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
                ContentType: file.fileType,
                Metadata: {
                    userId,
                    groupId,
                    imageIndex: String(index),
                },
            });
            
            const uploadUrl = await getSignedUrl(s3, command, {
                expiresIn: URL_EXPIRY_SECONDS,
            });
            
            return {
                uploadUrl,
                s3Key,
                index,
            };
        })
    );
    
    return {
        groupId,
        presignedUrls,
    };
}

module.exports = {
    generateMultiplePresignedUrls,
};
