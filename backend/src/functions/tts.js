const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, badRequest, serverError } = require("../utils/response");

// Uses the same AWS region as the rest of the app
const polly = new PollyClient({ region: process.env.AWS_REGION || "" });

// ── AWS Polly voice map ─────────────────────────────────────────────────────
// Polly only has NATIVE Indian-language support for English and Hindi.
// "Kajal" (neural) supports en-IN and hi-IN.
// For all other Indian languages, Polly has NO native voices - using a Hindi
// voice to read Tamil/Bengali/Telugu text produces terrible results.
// Instead, we tell the frontend to use browser-native speechSynthesis which
// has much better Indian language support (Chrome/Android use Google TTS).
//
// Full list: https://docs.aws.amazon.com/polly/latest/dg/voicelist.html
const VOICE_MAP = {
    "en-IN": { VoiceId: "Kajal", Engine: "neural", LanguageCode: "en-IN" },
    "hi-IN": { VoiceId: "Kajal", Engine: "neural", LanguageCode: "hi-IN" },
};

// Languages where Polly has no native voice - delegate to browser TTS
const BROWSER_TTS_LANGUAGES = new Set([
    "bn-IN", "ta-IN", "te-IN", "mr-IN",
    "kn-IN", "ml-IN", "gu-IN", "or-IN",
]);

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

    const { text, languageCode = "en-IN" } = body;
    if (!text?.trim()) return badRequest("text is required");

    // For unsupported languages, tell the frontend to use browser TTS
    if (BROWSER_TTS_LANGUAGES.has(languageCode)) {
        return ok({ useBrowserTTS: true, reason: `Polly has no native ${languageCode} voice` });
    }

    const voiceConfig = VOICE_MAP[languageCode] || VOICE_MAP["en-IN"];

    const input = {
        Text: text.substring(0, 1500),
        OutputFormat: "mp3",
        VoiceId: voiceConfig.VoiceId,
        LanguageCode: voiceConfig.LanguageCode,
        Engine: voiceConfig.Engine,
    };

    try {
        const command = new SynthesizeSpeechCommand(input);
        const response = await polly.send(command);

        // Convert stream to buffer
        const chunks = [];
        for await (let chunk of response.AudioStream) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);
        const audioBase64 = audioBuffer.toString("base64");

        return ok({ audioBase64 });
    } catch (err) {
        console.error(`[TTS ERROR] VoiceId=${input.VoiceId} Engine=${input.Engine} Lang=${input.LanguageCode} RequestedLang=${languageCode}`);
        console.error(`[TTS ERROR] ${err.name}: ${err.message}`);

        // If it's a credentials / access error, log that clearly
        if (err.name === "CredentialsProviderError" || err.name === "AccessDeniedException") {
            console.error("[TTS ERROR] AWS credentials missing or IAM policy lacks polly:SynthesizeSpeech permission.");
            return serverError("TTS unavailable - AWS credentials issue");
        }

        return serverError("Failed to synthesize speech");
    }
};
