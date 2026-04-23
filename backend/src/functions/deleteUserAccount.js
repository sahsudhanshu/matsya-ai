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
const { QueryCommand, DeleteCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "ai-bharat-users";
const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";
const GROUPS_TABLE = process.env.GROUPS_TABLE || "ai-bharat-groups";
const CHATS_TABLE = process.env.DYNAMODB_CHATS_TABLE || "ai-bharat-chats";
const CONVERSATIONS_TABLE = "ai-bharat-conversations";
const MESSAGES_TABLE = "ai-bharat-messages";
const MEMORY_TABLE = "ai-bharat-memory";

/**
 * Delete all items from a table that match a userId via a GSI query.
 * Returns the count of deleted items.
 */
async function deleteByUserId(tableName, indexName, userId, keyExtractor) {
    let deleted = 0;
    let lastKey;

    do {
        const result = await ddb.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: indexName,
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ExclusiveStartKey: lastKey,
            })
        );

        const items = result.Items || [];
        lastKey = result.LastEvaluatedKey;

        // Delete in batches of 25 (DynamoDB limit)
        for (let i = 0; i < items.length; i += 25) {
            const batch = items.slice(i, i + 25);
            const deleteRequests = batch.map((item) => ({
                DeleteRequest: {
                    Key: keyExtractor(item),
                },
            }));

            if (deleteRequests.length > 0) {
                await ddb.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [tableName]: deleteRequests,
                        },
                    })
                );
                deleted += deleteRequests.length;
            }
        }
    } while (lastKey);

    return deleted;
}

/**
 * Delete all messages for a list of conversation IDs.
 */
async function deleteMessagesForConversations(conversationIds) {
    let deleted = 0;

    for (const conversationId of conversationIds) {
        let lastKey;
        do {
            const result = await ddb.send(
                new QueryCommand({
                    TableName: MESSAGES_TABLE,
                    KeyConditionExpression: "conversationId = :cid",
                    ExpressionAttributeValues: { ":cid": conversationId },
                    ExclusiveStartKey: lastKey,
                })
            );

            const items = result.Items || [];
            lastKey = result.LastEvaluatedKey;

            for (let i = 0; i < items.length; i += 25) {
                const batch = items.slice(i, i + 25);
                const deleteRequests = batch.map((item) => ({
                    DeleteRequest: {
                        Key: {
                            conversationId: item.conversationId,
                            timestamp: item.timestamp,
                        },
                    },
                }));

                if (deleteRequests.length > 0) {
                    await ddb.send(
                        new BatchWriteCommand({
                            RequestItems: {
                                [MESSAGES_TABLE]: deleteRequests,
                            },
                        })
                    );
                    deleted += deleteRequests.length;
                }
            }
        } while (lastKey);
    }

    return deleted;
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
    const username = decoded.username;
    const summary = { userId, deletedCounts: {} };

    try {
        // 1. Delete groups
        try {
            summary.deletedCounts.groups = await deleteByUserId(
                GROUPS_TABLE, "userId-createdAt-index", userId,
                (item) => ({ groupId: item.groupId })
            );
        } catch (e) { console.error("Delete groups error:", e); summary.deletedCounts.groups = "error"; }

        // 2. Delete images (also check legacy username)
        try {
            let imgCount = await deleteByUserId(
                IMAGES_TABLE, "userId-createdAt-index", userId,
                (item) => ({ imageId: item.imageId })
            );
            if (username && username !== userId) {
                imgCount += await deleteByUserId(
                    IMAGES_TABLE, "userId-createdAt-index", username,
                    (item) => ({ imageId: item.imageId })
                );
            }
            summary.deletedCounts.images = imgCount;
        } catch (e) { console.error("Delete images error:", e); summary.deletedCounts.images = "error"; }

        // 3. Delete chats
        try {
            summary.deletedCounts.chats = await deleteByUserId(
                CHATS_TABLE, "userId-timestamp-index", userId,
                (item) => ({ chatId: item.chatId })
            );
        } catch (e) { console.error("Delete chats error:", e); summary.deletedCounts.chats = "error"; }

        // 4. Delete conversations + their messages
        try {
            // First get all conversation IDs
            const convResult = await ddb.send(
                new QueryCommand({
                    TableName: CONVERSATIONS_TABLE,
                    IndexName: "userId-updatedAt-index",
                    KeyConditionExpression: "userId = :uid",
                    ExpressionAttributeValues: { ":uid": userId },
                })
            );
            const conversations = convResult.Items || [];
            const conversationIds = conversations.map((c) => c.conversationId);

            // Delete messages for all conversations
            summary.deletedCounts.messages = await deleteMessagesForConversations(conversationIds);

            // Delete conversations themselves
            for (let i = 0; i < conversations.length; i += 25) {
                const batch = conversations.slice(i, i + 25);
                await ddb.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [CONVERSATIONS_TABLE]: batch.map((c) => ({
                                DeleteRequest: { Key: { conversationId: c.conversationId } },
                            })),
                        },
                    })
                );
            }
            summary.deletedCounts.conversations = conversations.length;
        } catch (e) { console.error("Delete conversations error:", e); summary.deletedCounts.conversations = "error"; }

        // 5. Delete memory
        try {
            await ddb.send(
                new DeleteCommand({
                    TableName: MEMORY_TABLE,
                    Key: { userId },
                })
            );
            summary.deletedCounts.memory = 1;
        } catch (e) { console.error("Delete memory error:", e); summary.deletedCounts.memory = "error"; }

        // 6. Delete user profile
        try {
            await ddb.send(
                new DeleteCommand({
                    TableName: USERS_TABLE,
                    Key: { userId },
                })
            );
            summary.deletedCounts.userProfile = 1;
        } catch (e) { console.error("Delete user profile error:", e); summary.deletedCounts.userProfile = "error"; }

        return ok({
            message: "Account and all associated data deleted successfully",
            summary,
        });
    } catch (err) {
        console.error("deleteUserAccount error:", err);
        return serverError("Failed to delete account");
    }
};
