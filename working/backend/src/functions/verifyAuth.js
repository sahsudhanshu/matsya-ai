const { verifyToken } = require('../utils/auth');

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

/**
 * Lightweight token-check endpoint.
 * GET /auth/verify - returns 200 if the Bearer token is valid, 401 otherwise.
 */
exports.handler = async (event) => {
    try {
        await verifyToken(event);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ valid: true }),
        };
    } catch (err) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ valid: false, message: 'Token is invalid or expired' }),
        };
    }
};
