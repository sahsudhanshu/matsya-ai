/**
 * DynamoDB Document Client singleton (AWS SDK v3)
 */
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { NodeHttpHandler } = require("@smithy/node-http-handler");

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "",
    maxAttempts: 3,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 5000,   // 5s to establish connection
        requestTimeout: 10000,     // 10s per request attempt
        socketTimeout: 10000,
    }),
});
const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

module.exports = { ddb };
