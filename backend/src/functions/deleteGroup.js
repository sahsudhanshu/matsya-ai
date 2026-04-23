/**
 * Lambda: DELETE /groups/:groupId
 *
 * Deletes a group record by groupId for the authenticated user.
 * Verifies ownership before deletion.
 */
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, notFound, badRequest, serverError } = require("../utils/response");
const { getGroupAnywhere, deleteGroupAnywhere } = require("../utils/groupsDb");

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    // Verify authentication
    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const groupId = event.pathParameters?.groupId;

    if (!groupId) {
        return badRequest("groupId is required");
    }

    try {
        // Verify the group exists and belongs to this user (checking both tables)
        const group = await getGroupAnywhere(groupId);

        if (!group) {
            return notFound("Group not found");
        }

        if (group.userId !== userId) {
            return unauthorized("You do not have permission to delete this group");
        }

        await deleteGroupAnywhere(groupId);

        return ok({ message: "Group deleted successfully", groupId });
    } catch (err) {
        console.error("deleteGroup error:", err);
        return serverError("Failed to delete group");
    }
};
