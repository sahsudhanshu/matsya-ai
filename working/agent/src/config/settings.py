"""
Application settings - all config via environment variables.
"""
import os


# ── Google Gemini ─────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

# ── MySQL Database ────────────────────────────────────────────────────────────
# Connection details are consumed directly by src/utils/db.py
# Exposed here for reference / startup checks only
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "defaultdb")
DB_SSL = os.getenv("DB_SSL", "false").lower() == "true"

# ── Cognito ──────────────────────────────────────────────────────────────────
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")

# ── External APIs ───────────────────────────────────────────────────────────
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
FISH_WEIGHT_API_URL = os.getenv("FISH_WEIGHT_API_URL", "")

# ── Memory tuning ───────────────────────────────────────────────────────────
SHORT_TERM_MESSAGE_LIMIT = int(os.getenv("SHORT_TERM_MESSAGE_LIMIT", "10"))
SUMMARY_CHUNK_SIZE = int(os.getenv("SUMMARY_CHUNK_SIZE", "10"))
CATCH_HISTORY_PAGE_SIZE = int(os.getenv("CATCH_HISTORY_PAGE_SIZE", "10"))

# ── Telegram ─────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ALERTS_ENABLED = os.getenv("TELEGRAM_ALERTS_ENABLED", "true").lower() == "true"
