// backend/lambda.js
const serverless = require('serverless-http');
const app = require('./server'); // Import your existing Express app

// Wrap the Express app for AWS Lambda
module.exports.handler = serverless(app);