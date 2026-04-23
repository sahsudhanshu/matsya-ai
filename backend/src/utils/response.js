/**
 * Shared utilities for all Lambda functions.
 * response.js - standard JSON response helpers
 */

const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

exports.ok = (body) => ({
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, ...body }),
});

exports.created = (body) => ({
    statusCode: 201,
    headers,
    body: JSON.stringify({ success: true, ...body }),
});

exports.badRequest = (message) => ({
    statusCode: 400,
    headers,
    body: JSON.stringify({ success: false, message }),
});

exports.unauthorized = (message = "Unauthorized") => ({
    statusCode: 401,
    headers,
    body: JSON.stringify({ success: false, message }),
});

exports.notFound = (message = "Not found") => ({
    statusCode: 404,
    headers,
    body: JSON.stringify({ success: false, message }),
});

exports.serverError = (message = "Internal server error") => ({
    statusCode: 500,
    headers,
    body: JSON.stringify({ success: false, message }),
});
