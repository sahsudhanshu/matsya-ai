"""
Telegram bot - handles user commands and interactions.

Commands:
  /start              - welcome + ask for location
  /subscribe          - same as /start
  /stop               - disable alerts
  /resume             - re-enable alerts
  /status             - show current subscription info
  /weather            - on-demand weather check
  /language <code>    - change language (en, hi, ta, te, kn, ml, bn, mr, gu, or)
  /help               - list commands

Location is collected via Telegram's native location-sharing feature.
"""
from __future__ import annotations
import logging

from telegram import Update, ReplyKeyboardRemove
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from src.telegram.subscribers import (
    get_subscriber,
    upsert_subscriber,
    set_alerts_enabled,
    delete_subscriber,
)
from src.telegram.alert_generator import generate_weather_alert
from src.telegram.catch_insights import get_catch_insights
from src.config.settings import TELEGRAM_BOT_TOKEN

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {
    "en": "English", "hi": "हिन्दी", "ta": "தமிழ்", "te": "తెలుగు",
    "kn": "ಕನ್ನಡ", "ml": "മലയാളം", "bn": "বাংলা", "mr": "मराठी",
    "gu": "ગુજરાતી", "or": "ଓଡ଼ିଆ",
}


# ── Command Handlers ─────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Welcome message - auto-subscribe if location is passed via deep link."""
    chat_id = update.effective_chat.id
    sub = get_subscriber(chat_id)

    # Check for deep-link location: /start loc_LAT_LON  or  /start loc_LAT_LON_USERID
    args = context.args
    if args and args[0].startswith("loc_"):
        try:
            parts = args[0].split("_")
            lat = float(parts[1])
            lon = float(parts[2])
            user_id = parts[3] if len(parts) >= 4 else ""
            location_name = _nearest_port_name(lat, lon)

            upsert_subscriber(
                telegram_chat_id=chat_id,
                latitude=lat,
                longitude=lon,
                location_name=location_name,
                user_id=user_id,
            )

            # Build welcome message with timing details
            welcome = (
                f"🌊 *Welcome to Matsya AI Alerts!*\n\n"
                f"✅ You're subscribed with location from the app!\n"
                f"📍 Location: {location_name} ({lat:.4f}°N, {lon:.4f}°E)\n\n"
                f"You'll receive *8 automated updates* daily:\n"
                f"🌙 05:00 · 🌅 07:00 · 🎣 09:30 · 📊 12:00\n"
                f"⛵ 14:30 · 🌆 17:00 · 🌊 19:30 · 📋 22:00\n\n"
                f"Commands: /weather /language /stop /help"
            )
            await update.message.reply_text(welcome, parse_mode="Markdown")

            # Fetch and send capture insights if userId available
            if user_id:
                try:
                    insights = await get_catch_insights(user_id)
                    if insights:
                        await update.message.reply_text(
                            f"🐟 *Your Capture Insights*\n\n{insights}",
                            parse_mode="Markdown",
                        )
                except Exception as e:
                    logger.error(f"Catch insights error for {chat_id}: {e}")

            return
        except (IndexError, ValueError):
            pass  # Fall through to normal flow

    if sub and sub.get("latitude"):
        await update.message.reply_text(
            f"🎣 Welcome back! You're already subscribed.\n"
            f"📍 Location: {sub.get('locationName', 'Set')}\n"
            f"🔔 Alerts: {'On' if sub.get('alertsEnabled') else 'Off'}\n\n"
            f"Send /help to see available commands.",
        )
        # Show capture insights for returning users too
        returning_uid = sub.get("userId", "")
        if returning_uid:
            try:
                insights = await get_catch_insights(returning_uid)
                if insights:
                    await update.message.reply_text(
                        f"🐟 *Your Capture Insights*\n\n{insights}",
                        parse_mode="Markdown",
                    )
            except Exception as e:
                logger.error(f"Catch insights error (returning) for {chat_id}: {e}")
        return

    # Fallback: no deep link - show timing + app intro (no location prompt)
    await update.message.reply_text(
        "🌊 *Welcome to Matsya AI - Your AI Fishing Companion!*\n\n"
        "I'll send you *8 personalised updates* every day:\n\n"
        "🌙 *05:00* - Pre-dawn safety & sea conditions\n"
        "🌅 *07:00* - Morning weather forecast\n"
        "🎣 *09:30* - Best fishing spots near you\n"
        "📊 *12:00* - Live market prices update\n"
        "⛵ *14:30* - Afternoon sea conditions\n"
        "🌆 *17:00* - Evening forecast & tips\n"
        "🌊 *19:30* - Night fishing advisory\n"
        "📋 *22:00* - Tomorrow's preview & prep\n\n"
        "📲 To activate alerts, tap *Connect to Telegram* in the matsya AI app - "
        "it will link your location & account automatically!",
        parse_mode="Markdown",
    )

    # Send app insights intro
    await update.message.reply_text(
        "📈 *What matsya AI Tracks For You*\n\n"
        "🐟 *Catch History* - Every fish you scan is logged with species, "
        "weight, quality grade & confidence score\n"
        "📊 *Analytics Dashboard* - Total catches, earnings, weekly trends, "
        "species breakdown & quality distribution\n"
        "🗺️ *Smart Maps* - Fishing hotspots, harbours, restricted zones "
        "& real-time weather overlay\n"
        "💰 *Market Prices* - Live ₹/kg rates for top species at nearby markets\n"
        "🧠 *AI Memory* - I remember your preferences, home port & favourite "
        "species to give better recommendations\n\n"
        "Start by scanning your catch in the app - I'll keep you updated here! 🎣",
        parse_mode="Markdown",
    )


async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle when user shares their location."""
    loc = update.message.location
    chat_id = update.effective_chat.id

    # Reverse-geocode to get a place name (simple approximation from fishing markers)
    location_name = _nearest_port_name(loc.latitude, loc.longitude)

    sub = upsert_subscriber(
        telegram_chat_id=chat_id,
        latitude=loc.latitude,
        longitude=loc.longitude,
        location_name=location_name,
    )

    await update.message.reply_text(
        f"✅ *Subscribed successfully!*\n\n"
        f"📍 Location: {location_name} ({loc.latitude:.4f}°N, {loc.longitude:.4f}°E)\n"
        f"🔔 You'll receive *8 updates daily* from 5 AM to 10 PM IST\n\n"
        f"Commands:\n"
        f"/weather - Check current weather now\n"
        f"/language - Change language (default: English)\n"
        f"/stop - Pause alerts\n"
        f"/help - All commands",
        reply_markup=ReplyKeyboardRemove(),
        parse_mode="Markdown",
    )


async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Pause alerts."""
    chat_id = update.effective_chat.id
    sub = get_subscriber(chat_id)
    if not sub:
        await update.message.reply_text("You're not subscribed yet. Send /start to begin.")
        return
    set_alerts_enabled(chat_id, False)
    await update.message.reply_text(
        "🔕 Alerts paused. Send /resume to turn them back on."
    )


async def cmd_resume(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Resume alerts."""
    chat_id = update.effective_chat.id
    sub = get_subscriber(chat_id)
    if not sub:
        await update.message.reply_text("You're not subscribed yet. Send /start to begin.")
        return
    set_alerts_enabled(chat_id, True)
    await update.message.reply_text("🔔 Alerts resumed! You'll get 8 updates daily from 5 AM to 10 PM IST.")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show subscription status."""
    chat_id = update.effective_chat.id
    sub = get_subscriber(chat_id)
    if not sub:
        await update.message.reply_text("Not subscribed. Send /start to begin.")
        return

    lang = LANGUAGE_NAMES.get(sub.get("language", "en"), "English")
    await update.message.reply_text(
        f"📊 *Your Subscription*\n\n"
        f"📍 Location: {sub.get('locationName', 'N/A')}\n"
        f"🌐 Language: {lang}\n"
        f"🔔 Alerts: {'✅ On' if sub.get('alertsEnabled') else '❌ Off'}\n"
        f"📅 Subscribed: {sub.get('subscribedAt', 'N/A')[:10]}",
        parse_mode="Markdown",
    )


async def cmd_weather(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """On-demand weather check."""
    chat_id = update.effective_chat.id
    sub = get_subscriber(chat_id)
    if not sub or not sub.get("latitude"):
        await update.message.reply_text(
            "Please share your location first. Send /start."
        )
        return

    await update.message.reply_text("⏳ Fetching weather & fishing conditions...")

    try:
        alert_text = await generate_weather_alert(
            latitude=float(sub["latitude"]),
            longitude=float(sub["longitude"]),
            location_name=sub.get("locationName", ""),
            language=sub.get("language", "en"),
        )
        # Telegram has 4096 char limit per message
        for i in range(0, len(alert_text), 4000):
            await update.message.reply_text(
                alert_text[i:i + 4000], parse_mode="Markdown"
            )
    except Exception as e:
        logger.error(f"Weather alert error for {chat_id}: {e}")
        await update.message.reply_text("❌ Sorry, couldn't fetch weather right now. Try again later.")


async def cmd_language(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Change language preference."""
    chat_id = update.effective_chat.id
    sub = get_subscriber(chat_id)
    if not sub:
        await update.message.reply_text("Not subscribed. Send /start first.")
        return

    args = context.args
    if not args:
        lang_list = "\n".join(f"  `{code}` - {name}" for code, name in LANGUAGE_NAMES.items())
        await update.message.reply_text(
            f"🌐 *Set Language*\n\nUsage: `/language hi`\n\nAvailable:\n{lang_list}",
            parse_mode="Markdown",
        )
        return

    code = args[0].lower().strip()
    if code not in LANGUAGE_NAMES:
        await update.message.reply_text(f"Unknown language '{code}'. Send /language to see options.")
        return

    upsert_subscriber(
        telegram_chat_id=chat_id,
        latitude=float(sub["latitude"]),
        longitude=float(sub["longitude"]),
        location_name=sub.get("locationName", ""),
        language=code,
        user_id=sub.get("userId", ""),
    )
    await update.message.reply_text(
        f"✅ Language changed to *{LANGUAGE_NAMES[code]}*. Alerts will now be in {LANGUAGE_NAMES[code]}.",
        parse_mode="Markdown",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show available commands."""
    await update.message.reply_text(
        "🎣 *matsya AI Bot Commands*\n\n"
        "/start - Subscribe to daily alerts\n"
        "/weather - Get current weather & fishing forecast\n"
        "/language - Change alert language\n"
        "/status - View your subscription\n"
        "/stop - Pause alerts\n"
        "/resume - Resume alerts\n"
        "/help - Show this message\n\n"
        "📍 You can also share a new location anytime to update your position.",
        parse_mode="Markdown",
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _nearest_port_name(lat: float, lon: float) -> str:
    """Find the nearest known fishing port/market to the given coordinates."""
    from src.tools.map_data import FISHING_MARKERS
    import math

    best_name = f"{lat:.2f}°N, {lon:.2f}°E"
    best_dist = float("inf")

    for marker in FISHING_MARKERS:
        dlat = lat - marker["lat"]
        dlon = lon - marker["lon"]
        dist = math.sqrt(dlat ** 2 + dlon ** 2)
        if dist < best_dist:
            best_dist = dist
            best_name = marker["name"]

    # Only use the port name if it's within ~100km (roughly 1 degree)
    if best_dist > 1.0:
        return f"Near {best_name}"
    return best_name


# ── Build the Telegram Application ──────────────────────────────────────────

def create_telegram_app() -> Application:
    """Create and configure the Telegram bot application."""
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN not set. Create a bot with @BotFather.")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Command handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("subscribe", cmd_start))
    app.add_handler(CommandHandler("stop", cmd_stop))
    app.add_handler(CommandHandler("resume", cmd_resume))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("weather", cmd_weather))
    app.add_handler(CommandHandler("language", cmd_language))
    app.add_handler(CommandHandler("help", cmd_help))

    # Location handler (when user shares location)
    app.add_handler(MessageHandler(filters.LOCATION, handle_location))

    return app
