/**
 * Lambda: DELETE /user/account
 *
 * Deletes the authenticated user's account and all associated data:
 *   1. All groups from ai-bharat-groups
 *   2. All images from ai-bharat-images
 *   3. All chats from ai-bharat-chats
 *   4. All conversations from ai-bharat-conversations
 *   5. Memory from ai-bharat-memory
 *   6. User profile from ai-bharat-users
 *
 * Does NOT delete the Cognito user (would require admin SDK).
 * The user is signed out on the frontend after this call.
 */
const { pool } = require("../utils/db");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const username = decoded.username;
    const summary = { userId, deletedCounts: {} };

    try {
        // Due to MySQL foreign keys with ON DELETE CASCADE, deleting from the users table 
        // will automatically delete all related records in images, groups, chats, 
        // conversations, messages, and memory.
        
        // However, to keep track of summary counts optionally or handle legacy data:
        // We will execute a single DELETE but first we might try to clean up legacy images for username
        
        if (username && username !== userId) {
            try {
                await pool.execute("DELETE FROM images WHERE userId = ?", [username]);
            } catch (e) {
                console.error("Cleanup legacy image error:", e);
            }
        }

        try {
            await pool.execute("DELETE FROM users WHERE userId = ?", [userId]);
            summary.deletedCounts.userProfile = 1;
            summary.deletedCounts.allRelatedData = "Deleted via CASCADE";
        } catch (e) { 
            console.error("Delete user profile error:", e); 
            summary.deletedCounts.userProfile = "error"; 
        }

        return ok({
            message: "Account and all associated data deleted successfully",
            summary,
        });
    } catch (err) {
        console.error("deleteUserAccount error:", err);
        return serverError("Failed to delete account");
    }
};
