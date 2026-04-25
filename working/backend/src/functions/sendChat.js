/**
 * Lambda: POST /chat
 *
 * Accepts a user message, calls the AI/ML chat endpoint (placeholder),
 * stores both message and response in MySQL chats table.
 *
 * Body: { message: string }
 * Returns: { chatId, response, timestamp }
 *
 * ⚠️  PLUG IN YOUR AGENTIC AI: Replace CHAT_API_URL env var with your real endpoint.
 */
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../utils/db");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, badRequest, serverError } = require("../utils/response");

const CHAT_API_URL = process.env.CHAT_API_URL || "https://chat-api.example.com/chat";
const CHAT_API_KEY = process.env.CHAT_API_KEY || "";

// Placeholder AI responses (remove once real API is connected)
const PLACEHOLDER_RESPONSES = [
    "Based on today's market data, Pomfret is trading at ₹440–₹480/kg at Vashi APMC - 12% above the weekly average. I recommend selling there today.",
    "The freshness window for your catch is optimal right now. Delaying by 4+ hours could reduce your grade from Premium to Standard, costing ~₹120 per kg.",
    "I found 3 verified buyers interested in your Hilsa catch near Colaba. Would you like me to connect you with the highest bidder at ₹680/kg?",
    "Weather advisory: Rough sea conditions (2.5m waves) are expected tomorrow afternoon near Versova coast. Plan your return by 11 AM for safety.",
];

let respIdx = 0;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch {
        return badRequest("Invalid JSON body");
    }

    const { message } = body;
    if (!message?.trim()) return badRequest("message is required");

    const chatId = uuidv4();
    const userId = decoded.sub;
    const timestamp = new Date().toISOString();

    let aiResponse;

    try {
        if (CHAT_API_URL.includes("example.com")) {
            // ── Placeholder response ──────────────────────────────────────────────
            await new Promise((r) => setTimeout(r, 800));
            aiResponse = PLACEHOLDER_RESPONSES[respIdx % PLACEHOLDER_RESPONSES.length];
            respIdx++;
            // ─────────────────────────────────────────────────────────────────────
        } else {
            // ── Real Agentic AI call ──────────────────────────────────────────────
            const authHeader = event.headers?.Authorization || event.headers?.authorization;
            const chatApiRes = await fetch(CHAT_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(CHAT_API_KEY ? { "x-api-key": CHAT_API_KEY } : {}),
                    ...(authHeader ? { "Authorization": authHeader } : {}),
                },
                body: JSON.stringify({ message }),
            });
            if (!chatApiRes.ok) throw new Error(`Chat API returned ${chatApiRes.status}`);
            const data = await chatApiRes.json();
            aiResponse = data.response || "Sorry, I could not generate a response.";
            // ─────────────────────────────────────────────────────────────────────
        }

        // Persist to MySQL
        await pool.execute(
            `INSERT INTO chats (chatId, userId, message, role, timestamp) VALUES (?, ?, ?, 'user', ?)`,
            [chatId, userId, message.trim(), timestamp]
        );
        const responseChatId = uuidv4();
        await pool.execute(
            `INSERT INTO chats (chatId, userId, message, role, timestamp) VALUES (?, ?, ?, 'assistant', ?)`,
            [responseChatId, userId, aiResponse, new Date().toISOString()]
        );

        return ok({ chatId, response: aiResponse, timestamp });
    } catch (err) {
        console.error("sendChat error:", err);
        return serverError("Failed to get AI response");
    }
};
