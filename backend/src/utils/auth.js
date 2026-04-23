/**
 * Cognito JWT middleware
 *
 * Usage in Lambda handler:
 *   const { verifyToken } = require('./utils/auth');
 *   const decoded = await verifyToken(event);  // throws if invalid
 */
const { CognitoJwtVerifier } = require("aws-jwt-verify");

let verifier;

function getVerifier() {
    if (!verifier) {
        verifier = CognitoJwtVerifier.create({
            userPoolId: process.env.COGNITO_USER_POOL_ID,
            tokenUse: "access",
            clientId: process.env.COGNITO_CLIENT_ID,
        });
    }
    return verifier;
}

/**
 * Extracts and verifies the Cognito Bearer token from the Authorization header.
 * Returns the decoded JWT payload.
 * Throws an Error if the token is missing or invalid.
 */
async function verifyToken(event) {
    const authHeader =
        event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }

    const token = authHeader.split(" ")[1];


    const payload = await getVerifier().verify(token);
    return payload;
}

module.exports = { verifyToken };
