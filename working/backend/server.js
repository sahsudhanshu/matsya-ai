require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { runStartupChecks } = require('./src/utils/startup-check');

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const MAX_LOG_LEN = 800;

function truncateForLog(value) {
    if (value === undefined || value === null) return '';
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return str.length > MAX_LOG_LEN ? `${str.slice(0, MAX_LOG_LEN)}...[truncated]` : str;
}

// Global request/response logger (including non-Lambda routes)
app.use((req, res, next) => {
    const start = Date.now();
    const requestPreview = truncateForLog({
        params: req.params,
        query: req.query,
        body: req.body,
    });

    let responsePreview = '';
    const originalSend = res.send.bind(res);
    res.send = (body) => {
        responsePreview = truncateForLog(body);
        return originalSend(body);
    };

    console.log(`[BACKEND][REQ] ${req.method} ${req.originalUrl} payload=${requestPreview}`);

    res.on('finish', () => {
        const durationMs = Date.now() - start;
        console.log(
            `[BACKEND][RES] ${req.method} ${req.originalUrl} status=${res.statusCode} duration=${durationMs}ms payload=${responsePreview}`
        );
    });

    next();
});

// Helper to convert Express req/res to Lambda Event format
const runLambda = async (req, res, lambdaHandler) => {
    const hasBody = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
    const event = {
        httpMethod: req.method,
        path: req.path,
        headers: req.headers,
        queryStringParameters: req.query,
        pathParameters: req.params,
        body: hasBody ? JSON.stringify(req.body) : null
    };

    try {
        const result = await lambdaHandler(event);
        console.log(`[BACKEND][LAMBDA] ${req.method} ${req.path} statusCode=${result.statusCode} body=${truncateForLog(result.body)}`);
        res.status(result.statusCode).set(result.headers || {}).send(result.body);
    } catch (err) {
        console.error(`[BACKEND][ERROR] ${req.method} ${req.path}`, err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'matsya-ai-backend' }));

// Auth token verification endpoint
app.get('/auth/verify', (req, res) => runLambda(req, res, require('./src/functions/verifyAuth.js').handler));

// Route Definitions mapping to Lambda functions
app.get("/", (req, res) => res.send("Hello How are you?"));
app.post('/images/presigned-url', (req, res) => runLambda(req, res, require('./src/functions/getPresignedUrl.js').handler));
app.post('/images/:imageId/analyze', (req, res) => runLambda(req, res, require('./src/functions/analyzeImage.js').handler));
app.get('/images', (req, res) => runLambda(req, res, require('./src/functions/getImages.js').handler));
app.get('/map', (req, res) => runLambda(req, res, require('./src/functions/getMapData.js').handler));
app.post('/chat', (req, res) => runLambda(req, res, require('./src/functions/sendChat.js').handler));
app.get('/chat', (req, res) => runLambda(req, res, require('./src/functions/getChatHistory.js').handler));
app.post('/tts', (req, res) => runLambda(req, res, require('./src/functions/tts.js').handler));
app.get('/analytics', (req, res) => runLambda(req, res, require('./src/functions/getAnalytics.js').handler));

// Group-based multi-image analysis routes
app.post('/groups/presigned-urls', (req, res) => runLambda(req, res, require('./src/functions/createGroupPresignedUrls.js').handler));
app.post('/groups/:groupId/analyze', (req, res) => runLambda(req, res, require('./src/functions/analyzeGroup.js').handler));
app.get('/groups', (req, res) => runLambda(req, res, require('./src/functions/getGroups.js').handler));
app.get('/groups/:groupId', (req, res) => runLambda(req, res, require('./src/functions/getGroupDetails.js').handler));
app.delete('/groups/:groupId', (req, res) => runLambda(req, res, require('./src/functions/deleteGroup.js').handler));

// User profile routes
app.get('/user/profile', (req, res) => runLambda(req, res, require('./src/functions/getUserProfile.js').handler));
app.put('/user/profile', (req, res) => runLambda(req, res, require('./src/functions/updateUserProfile.js').handler));
app.get('/user/export', (req, res) => runLambda(req, res, require('./src/functions/exportUserData.js').handler));
app.delete('/user/account', (req, res) => runLambda(req, res, require('./src/functions/deleteUserAccount.js').handler));
app.get('/user/public/:slug', (req, res) => runLambda(req, res, require('./src/functions/getPublicProfile.js').handler));

// Weight estimate sync
app.post('/weight-estimates', (req, res) => runLambda(req, res, require('./src/functions/saveWeightEstimate.js').handler));

// Offline session sync (two-phase: prepare → upload to S3 → commit)
app.post('/sync/offline-session/:action', (req, res) => runLambda(req, res, require('./src/functions/syncOfflineSession.js').handler));

// ── Export app for Lambda and start server if local ────────────────────────
module.exports = app;

if (require.main === module) {
    (async () => {
        const diagnostics = await runStartupChecks();

        if (!diagnostics.ok) {
            console.error('\n❌  Critical startup checks failed. Fix the issues above before continuing.\n');
            process.exit(1);
        }

        let server = app.listen(port, () => {
            console.log(`\n🐟  matsya AI Backend Local Server running at http://localhost:${port}`);
            console.log(`Ready to accept requests from the frontend!`);
            console.log(`\nAvailable endpoints:`);
            console.log(`  POST /images/presigned-url`);
            console.log(`  POST /images/:imageId/analyze`);
            console.log(`  GET  /images`);
            console.log(`  GET  /map`);
            console.log(`  POST /chat`);
            console.log(`  GET  /chat`);
            console.log(`  GET  /analytics`);
            console.log(`  POST /groups/presigned-urls`);
            console.log(`  POST /groups/:groupId/analyze`);
            console.log(`  GET  /groups`);
            console.log(`  GET  /groups/:groupId`);
            console.log(`  DELETE /groups/:groupId`);
            console.log(`  POST /sync/offline-session/prepare`);
            console.log(`  POST /sync/offline-session/commit`);
            console.log(`\nPress Ctrl+C to stop the server\n`);
        });

        server.on('close', () => console.log('Server closed'));
        server.on('error', (err) => {
            console.error('Server error:', err);
            process.exit(1);
        });
    })();
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
