const fs = require('fs');
const { DynamoDBClient, DeleteTableCommand, CreateTableCommand, DescribeTableCommand, waitUntilTableNotExists, waitUntilTableExists } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "" });

async function run() {
    const rawData = fs.readFileSync("../infrastructure/dynamodb-tables.json");
    const config = JSON.parse(rawData);

    for (const tableDef of config.Tables) {
        const tableName = tableDef.TableName;
        console.log(`\nChecking table: ${tableName}`);

        let exists = true;
        try {
            await client.send(new DescribeTableCommand({ TableName: tableName }));
        } catch (err) {
            if (err.name === "ResourceNotFoundException") {
                exists = false;
            } else {
                throw err;
            }
        }

        if (exists) {
            console.log(`Deleting existing table ${tableName}...`);
            await client.send(new DeleteTableCommand({ TableName: tableName }));
            console.log(`Waiting for deletion...`);
            await waitUntilTableNotExists({ client, maxWaitTime: 120 }, { TableName: tableName });
            console.log(`Deleted.`);
        }

        console.log(`Creating table ${tableName}...`);

        const createCmd = new CreateTableCommand({
            TableName: tableDef.TableName,
            BillingMode: tableDef.BillingMode,
            KeySchema: tableDef.KeySchema,
            AttributeDefinitions: tableDef.AttributeDefinitions,
            ...(tableDef.GlobalSecondaryIndexes ? { GlobalSecondaryIndexes: tableDef.GlobalSecondaryIndexes } : {}),
            ...(tableDef.LocalSecondaryIndexes ? { LocalSecondaryIndexes: tableDef.LocalSecondaryIndexes } : {})
        });

        await client.send(createCmd);
        console.log(`Waiting for creation...`);
        await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: tableName });
        console.log(`Created!`);
    }

    console.log("\nAll tables recreated successfully with GSIs!");
}

run().catch(console.error);
