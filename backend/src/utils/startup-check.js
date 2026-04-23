/**
 * Development-mode startup diagnostics for matsya AI Backend.
 * Validates required environment variables and probes external service connectivity.
 * Only runs when NODE_ENV !== 'production'.
 */

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

// ── ANSI color helpers ──────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
};

const OK = `${c.green}✅${c.reset}`;
const WARN = `${c.yellow}⚠️${c.reset}`;
const FAIL = `${c.red}❌${c.reset}`;
const INFO = `${c.blue}ℹ️${c.reset}`;

// ── Check definitions ───────────────────────────────────────────────────────

const ENV_CHECKS = [
    // [name, envKey, level: 'critical'|'warn', description]
    ['S3_BUCKET_NAME', 'S3_BUCKET_NAME', 'critical', 'S3 bucket for image storage'],
    ['AWS_REGION', 'AWS_REGION', 'critical', 'AWS region for DynamoDB/S3'],
    ['COGNITO_USER_POOL_ID', 'COGNITO_USER_POOL_ID', 'critical', 'Cognito user pool for auth'],
    ['COGNITO_CLIENT_ID', 'COGNITO_CLIENT_ID', 'critical', 'Cognito client ID for auth'],
    ['DYNAMODB_IMAGES_TABLE', 'DYNAMODB_IMAGES_TABLE', 'warn', 'DynamoDB images table'],
    ['DYNAMODB_CHATS_TABLE', 'DYNAMODB_CHATS_TABLE', 'warn', 'DynamoDB chats table'],
    ['DYNAMODB_USERS_TABLE', 'DYNAMODB_USERS_TABLE', 'warn', 'DynamoDB users table'],
    ['GROUPS_TABLE', 'GROUPS_TABLE', 'warn', 'DynamoDB groups table'],
    ['ML_API_URL', 'ML_API_URL', 'warn', 'ML prediction API URL'],
    ['ML_API_KEY', 'ML_API_KEY', 'warn', 'ML API authentication key'],
    ['CHAT_API_URL', 'CHAT_API_URL', 'warn', 'Agent chat API URL'],
    ['OPENWEATHERMAP_API_KEY', 'OPENWEATHERMAP_API_KEY', 'warn', 'OpenWeatherMap API key'],
];

// ── Main diagnostics runner ─────────────────────────────────────────────────

async function runStartupChecks() {
    if (process.env.NODE_ENV === 'production') return { ok: true };

    const results = { criticalErrors: 0, warnings: 0, checks: [] };

    console.log('');
    console.log(`${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.cyan}${c.bold}║  🐟 matsya AI Backend - Development Startup Diagnostics        ║${c.reset}`);
    console.log(`${c.cyan}${c.bold}╠══════════════════════════════════════════════════════════════════╣${c.reset}`);

    // ── 1. Environment Variables ─────────────────────────────────────────────
    console.log(`${c.cyan}${c.bold}║  ${c.white}Environment Variables${c.reset}`);
    console.log(`${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`);

    for (const [name, envKey, level, desc] of ENV_CHECKS) {
        const value = process.env[envKey];
        const maxLen = 30;

        if (value) {
            const display = value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
            console.log(`${c.cyan}║${c.reset}  ${OK} ${name.padEnd(26)} = ${c.dim}${display}${c.reset}`);
            results.checks.push({ name, status: 'ok' });
        } else if (level === 'critical') {
            console.log(`${c.cyan}║${c.reset}  ${FAIL} ${name.padEnd(26)} = ${c.red}${c.bold}MISSING${c.reset}  ${c.dim}(${desc})${c.reset}`);
            results.criticalErrors++;
            results.checks.push({ name, status: 'critical' });
        } else {
            console.log(`${c.cyan}║${c.reset}  ${WARN} ${name.padEnd(26)} = ${c.yellow}not set${c.reset}  ${c.dim}(${desc})${c.reset}`);
            results.warnings++;
            results.checks.push({ name, status: 'warn' });
        }
    }

    // ── 2. Connectivity Probes ──────────────────────────────────────────────
    console.log(`${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`);
    console.log(`${c.cyan}${c.bold}║  ${c.white}Connectivity${c.reset}`);
    console.log(`${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`);

    // DynamoDB
    try {
        const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || '' });
        const res = await ddb.send(new ListTablesCommand({}));
        const count = res.TableNames?.length || 0;
        console.log(`${c.cyan}║${c.reset}  ${OK} ${'DynamoDB'.padEnd(26)} = ${c.green}connected${c.reset} ${c.dim}(${count} tables)${c.reset}`);
    } catch (err) {
        console.log(`${c.cyan}║${c.reset}  ${FAIL} ${'DynamoDB'.padEnd(26)} = ${c.red}unreachable${c.reset}  ${c.dim}${err.message?.slice(0, 50)}${c.reset}`);
        results.criticalErrors++;
    }

    // S3 Bucket
    if (process.env.S3_BUCKET_NAME) {
        try {
            const s3 = new S3Client({ region: process.env.AWS_REGION || '' });
            await s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET_NAME }));
            console.log(`${c.cyan}║${c.reset}  ${OK} ${'S3 Bucket'.padEnd(26)} = ${c.green}accessible${c.reset}`);
        } catch (err) {
            console.log(`${c.cyan}║${c.reset}  ${WARN} ${'S3 Bucket'.padEnd(26)} = ${c.yellow}error${c.reset}  ${c.dim}${err.message?.slice(0, 50)}${c.reset}`);
            results.warnings++;
        }
    }

    // Agent API
    const agentUrl = process.env.CHAT_API_URL?.replace('/chat', '') || '';
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${agentUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            console.log(`${c.cyan}║${c.reset}  ${OK} ${'Agent API'.padEnd(26)} = ${c.green}${agentUrl}${c.reset} ${c.dim}(healthy)${c.reset}`);
        } else {
            console.log(`${c.cyan}║${c.reset}  ${WARN} ${'Agent API'.padEnd(26)} = ${c.yellow}${agentUrl}${c.reset} ${c.dim}(status ${res.status})${c.reset}`);
            results.warnings++;
        }
    } catch {
        console.log(`${c.cyan}║${c.reset}  ${WARN} ${'Agent API'.padEnd(26)} = ${c.yellow}unreachable${c.reset}  ${c.dim}${agentUrl}${c.reset}`);
        results.warnings++;
    }

    // ML API
    const mlUrl = process.env.ML_API_URL || '';
    if (mlUrl) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(mlUrl.replace('/predict', '/'), { signal: controller.signal });
            clearTimeout(timeout);
            console.log(`${c.cyan}║${c.reset}  ${OK} ${'ML API'.padEnd(26)} = ${c.green}reachable${c.reset} ${c.dim}(status ${res.status})${c.reset}`);
        } catch {
            console.log(`${c.cyan}║${c.reset}  ${WARN} ${'ML API'.padEnd(26)} = ${c.yellow}unreachable${c.reset}  ${c.dim}${mlUrl}${c.reset}`);
            results.warnings++;
        }
    }

    // ── 3. Summary ──────────────────────────────────────────────────────────
    console.log(`${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`);

    if (results.criticalErrors > 0) {
        console.log(`${c.cyan}║${c.reset}  ${c.bgRed}${c.white}${c.bold} RESULT ${c.reset} ${c.red}${results.criticalErrors} critical error(s)${c.reset}, ${c.yellow}${results.warnings} warning(s)${c.reset}`);
    } else if (results.warnings > 0) {
        console.log(`${c.cyan}║${c.reset}  ${c.bgYellow}${c.bold} RESULT ${c.reset} ${c.green}0 critical errors${c.reset}, ${c.yellow}${results.warnings} warning(s)${c.reset}`);
    } else {
        console.log(`${c.cyan}║${c.reset}  ${c.bgGreen}${c.bold} RESULT ${c.reset} ${c.green}All checks passed!${c.reset}`);
    }

    console.log(`${c.cyan}${c.bold}╚══════════════════════════════════════════════════════════════════╝${c.reset}`);
    console.log('');

    return { ok: results.criticalErrors === 0, ...results };
}

module.exports = { runStartupChecks };
