/**
 * Cognito JWT middleware
 *
 * Usage in Lambda handler:
 *   const { verifyToken } = require('./utils/auth');
 *   const decoded = await verifyToken(event);  // throws if invalid
 */
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first"); // Fixes 1.5s timeout on broken IPv6 networks

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
let jwksPrefetched = false;

async function verifyToken(event) {
    const authHeader =
        event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }

    const token = authHeader.split(" ")[1];
    const v = getVerifier();

    // Pre-fetch JWKS manually because aws-jwt-verify's internal fetcher has a hardcoded 1.5s timeout
    // that fails on networks with slow IPv6 DNS fallback. Native fetch works in ~3s.
    if (!jwksPrefetched) {
        try {
            const url = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
            const res = await fetch(url);
            const jwks = await res.json();
            
            // aws-jwt-verify requires caching by full issuer URL for Cognito JWTs
            const issuer = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
            
            // For aws-jwt-verify v4+, cacheJwks takes the jwks and the userPoolId or issuer string
            v.cacheJwks(jwks, process.env.COGNITO_USER_POOL_ID);
            
            jwksPrefetched = true;
            console.log("Successfully pre-fetched and cached Cognito JWKS manually.");
        } catch (err) {
            console.warn("Failed to pre-fetch JWKS manually:", err.message);
        }
    }

    const payload = await v.verify(token);
    return payload;
}

module.exports = { verifyToken };
