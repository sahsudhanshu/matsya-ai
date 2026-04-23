/**
 * ML API client wrapper for fish analysis
 * 
 * Provides functions to:
 * - Call ML API for single image analysis
 * - Fetch images from S3 and convert to buffer/base64
 * - Parse ML API responses
 * - Handle ML API errors gracefully
 * 
 * Validates: Requirements 3.2, 3.3
 */

const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("./s3");

const BUCKET = process.env.S3_BUCKET_NAME || "ai-bharat-fish-images";
const ML_API_URL = process.env.ML_API_URL || "";

/**
 * Convert a readable stream to a buffer
 * 
 * @param {ReadableStream} stream - The stream to convert
 * @returns {Promise<Buffer>} The buffer containing stream data
 */
function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

/**
 * Fetch image from S3 and convert to buffer
 * 
 * @param {string} s3Key - S3 key of the image
 * @returns {Promise<Object>} Object containing buffer and content type
 * @returns {Buffer} return.buffer - Image data as buffer
 * @returns {string} return.contentType - MIME type of the image
 * @throws {Error} If S3 fetch fails
 */
async function fetchImageFromS3(s3Key) {
    try {
        const getObj = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
            })
        );

        const buffer = await streamToBuffer(getObj.Body);
        const contentType = getObj.ContentType || "image/jpeg";

        return { buffer, contentType };
    } catch (error) {
        console.error(`Failed to fetch image from S3: ${s3Key}`, error);
        throw new Error(`Failed to fetch image from S3: ${error.message}`);
    }
}

/**
 * Call ML API for single image analysis
 * 
 * @param {string} s3Key - S3 key of the image to analyze
 * @returns {Promise<Object>} ML API response with crops and yolo_image_url
 * @returns {Object} return.crops - Object containing crop data keyed by crop_id
 * @returns {string} return.yolo_image_url - URL to YOLO detection visualization
 * @throws {Error} If ML API call fails or returns invalid response
 * 
 * Validates: Requirements 3.2, 3.3
 */
async function callMLApi(s3Key) {
    try {
        // Fetch image from S3
        const { buffer, contentType } = await fetchImageFromS3(s3Key);

        // Prepare form data for ML API
        const formData = new FormData();
        const blob = new Blob([buffer], { type: contentType });
        const fileName = s3Key.split("/").pop() || "image.jpg";
        formData.append("image", blob, fileName);

        // Call ML API
        const response = await fetch(ML_API_URL, {
            method: "POST",
            body: formData,
        });

        // Check response status
        if (!response.ok) {
            throw new Error(`ML API returned status ${response.status}`);
        }

        // Parse response
        const data = await response.json();

        // Validate response structure
        if (!data || typeof data !== "object") {
            throw new Error("ML API returned invalid response format");
        }

        // Return structured response
        return {
            crops: data.crops || {},
            yolo_image_url: data.yolo_image_url || null,
        };
    } catch (error) {
        // Log error details
        console.error(`ML API call failed for ${s3Key}:`, error);

        // Return error without throwing to allow graceful handling
        return {
            error: error.message || "ML API call failed",
            crops: {},
            yolo_image_url: null,
        };
    }
}

/**
 * Process multiple images concurrently using Promise.all()
 * 
 * @param {string[]} s3Keys - Array of S3 keys to process
 * @returns {Promise<Array>} Array of results with success/error status per image
 * @returns {number} return[].imageIndex - Index of the image in the input array
 * @returns {string} return[].s3Key - S3 key of the image
 * @returns {Object} return[].crops - Crop data if successful
 * @returns {string} return[].yolo_image_url - YOLO visualization URL if successful
 * @returns {string} return[].error - Error message if failed
 * 
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6
 */
async function processImagesAsync(s3Keys) {
    // Call ML API for all images concurrently using Promise.all()
    const promises = s3Keys.map((s3Key, index) =>
        callMLApi(s3Key).then(result => ({
            imageIndex: index,
            s3Key,
            ...result,
        }))
    );

    // Wait for all promises to complete
    // Promise.all() will wait for all to finish, even if some fail
    // (since callMLApi returns error objects instead of throwing)
    const results = await Promise.all(promises);

    return results;
}

module.exports = {
    callMLApi,
    fetchImageFromS3,
    processImagesAsync,
};
