"""
Alert generator - uses Gemini LLM + existing tools to compose
personalized fishing alerts for Telegram subscribers.

Eight daily alert types:
  1. Pre-dawn safety & conditions       (05:00 IST)
  2. Morning weather forecast            (07:00 IST)
  3. Best fishing spot recommendation    (09:30 IST)
  4. Noon market prices update           (12:00 IST)
  5. Afternoon sea conditions            (14:30 IST)
  6. Evening forecast + tips             (17:00 IST)
  7. Night fishing conditions            (19:30 IST)
  8. Next day preview                    (22:00 IST)
"""
from __future__ import annotations
import logging
import random
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from src.tools.weather import get_weather
from src.tools.map_data import FISHING_MARKERS, RESTRICTED_AREAS
from src.tools.market_prices import get_market_prices
from src.memory.db_store import get_long_term_memory
from src.config.settings import GOOGLE_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)


def _get_llm():
    """Get an LLM instance for alert generation, preferring Claude with Gemini fallback."""
    import os
    from langchain_aws import ChatBedrockConverse

    use_claude = os.getenv("USE_CLAUDE", "true").strip().lower() in ("1", "true", "yes")
    use_gemini = os.getenv("USE_GEMINI", "true").strip().lower() in ("1", "true", "yes")

    claude_model = None
    if use_claude:
        try:
            claude_model = ChatBedrockConverse(
                model="global.anthropic.claude-sonnet-4-6",
                region_name=os.getenv("BEDROCK_REGION", "us-east-1"),
                temperature=0.8,
                max_tokens=1500,
                bedrock_api_key=os.getenv("BEDROCK_API_KEY", "") or None,
            )
        except Exception:
            pass

    gemini_model = None
    if use_gemini:
        try:
            gemini_model = ChatGoogleGenerativeAI(
                model=GEMINI_MODEL or "gemini-3-flash-preview",
                google_api_key=GOOGLE_API_KEY,
                temperature=0.8,
                max_output_tokens=1500,
            )
        except Exception:
            pass

    if claude_model and gemini_model:
        return claude_model.with_fallbacks([gemini_model])
    elif claude_model:
        return claude_model
    elif gemini_model:
        return gemini_model
    else:
        raise RuntimeError("No LLM available for alert generation")


LANG_LABELS = {
    "en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu",
    "kn": "Kannada", "ml": "Malayalam", "bn": "Bengali", "mr": "Marathi",
    "gu": "Gujarati", "or": "Odia",
}

SYSTEM_ROLE = "You are matsya AI, a concise Telegram alert bot for Indian fishermen."


# ── Helper to call LLM with fallback ────────────────────────────────────────

async def _generate(prompt: str, fallback: str) -> str:
    """Call Gemini with a prompt; return fallback on error."""
    try:
        llm = _get_llm()
        response = await llm.ainvoke([
            SystemMessage(content=SYSTEM_ROLE),
            HumanMessage(content=prompt),
        ])
        return _extract_text(response.content)
    except Exception as e:
        logger.error(f"LLM alert generation failed: {e}")
        return fallback


async def _get_weather_data(latitude: float, longitude: float, location_name: str) -> str:
    """Fetch weather data via tool."""
    try:
        return await get_weather.ainvoke({
            "latitude": latitude,
            "longitude": longitude,
            "location_name": location_name or None,
        })
    except Exception as e:
        logger.error(f"Weather fetch failed: {e}")
        return "Weather data temporarily unavailable."


async def _get_market_data(latitude: float, longitude: float) -> str:
    """Fetch market prices for nearest port."""
    nearest_port = _find_nearest_port(latitude, longitude)
    if not nearest_port:
        return ""
    try:
        return await get_market_prices.ainvoke({"port_name": nearest_port})
    except Exception:
        return ""


def _get_user_memory(user_id: str) -> str:
    """Get user's long-term memory if available."""
    if not user_id:
        return ""
    return get_long_term_memory(user_id) or ""


def _lang(language: str) -> str:
    return LANG_LABELS.get(language, "English")


# ═══════════════════════════════════════════════════════════════════════════
# 1. PRE-DAWN ALERT (05:00 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_predawn_alert(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Pre-dawn safety check + early conditions."""
    weather = await _get_weather_data(latitude, longitude, location_name)
    ban_info = _check_active_bans(latitude, longitude)

    prompt = f"""Compose a SHORT pre-dawn alert (max 600 chars) for a fisherman about to head out.

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic_.
- Include: wind speed, wave height, visibility, safety advisory.
- Start with 🌙 emoji. Be urgent about any dangers.
{f"- ACTIVE BAN: {ban_info}. WARN THE USER!" if ban_info else ""}

WEATHER DATA:
{weather}

LOCATION: {location_name or f"{latitude:.2f}°N, {longitude:.2f}°E"}

Generate the alert now. No preamble:"""

    return await _generate(prompt, f"🌙 *Pre-Dawn Check*\n\n{weather}")


# ═══════════════════════════════════════════════════════════════════════════
# 2. MORNING WEATHER (07:00 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_weather_alert(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Morning weather forecast + fishing advisory."""
    weather = await _get_weather_data(latitude, longitude, location_name)
    market_data = await _get_market_data(latitude, longitude)
    user_memory = _get_user_memory(user_id)

    prompt = f"""Compose a SHORT morning alert (max 800 chars) for Telegram.

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic_.
- Include emojis for warmth.
- Include: weather summary, safety advisory, fishing recommendation.
- If market prices available, mention top 2-3 species & prices.

WEATHER DATA:
{weather}

MARKET DATA:
{market_data if market_data else "Not available today"}

USER PREFERENCES:
{user_memory if user_memory else "New user, no history yet"}

Generate the alert. Start with 🌅:"""

    return await _generate(prompt, f"🌅 *Morning Forecast*\n\n{weather}")


# ═══════════════════════════════════════════════════════════════════════════
# 3. BEST FISHING SPOTS (09:30 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_best_spot_alert(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Best fishing spot recommendation based on weather + known spots."""
    weather = await _get_weather_data(latitude, longitude, location_name)
    nearby_spots = _get_nearby_spots(latitude, longitude, radius_deg=2.0)
    user_memory = _get_user_memory(user_id)

    prompt = f"""Recommend the BEST fishing spot for today (max 700 chars) for Telegram.

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic*.
- Consider weather for safe areas.
- Mention specific harbors/spots by name.
- Include emojis. Start with 🎣

CURRENT WEATHER:
{weather}

NEARBY SPOTS:
{nearby_spots}

USER PREFERENCES:
{user_memory if user_memory else "No specific preferences."}

Generate the recommendation:"""

    return await _generate(prompt, "🎣 Check nearby harbors for today's best catch opportunities!")


# ═══════════════════════════════════════════════════════════════════════════
# 4. NOON MARKET UPDATE (12:00 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_market_update(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Noon market prices & demand update."""
    market_data = await _get_market_data(latitude, longitude)
    weather = await _get_weather_data(latitude, longitude, location_name)

    prompt = f"""Compose a NOON market update (max 700 chars) for a fisherman on Telegram.

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic_.
- Focus on: current market prices, which species are in demand, best time to sell.
- Include a brief midday weather/sea update.
- Start with 📊 emoji.

MARKET DATA:
{market_data if market_data else "Market data not available - encourage the user to check local market."}

WEATHER UPDATE:
{weather}

LOCATION: {location_name or f"{latitude:.2f}°N, {longitude:.2f}°E"}

Generate the update:"""

    fallback = "📊 *Midday Market Update*\n\nCheck your local market for current prices. Stay hydrated and safe out there! 💧"
    return await _generate(prompt, fallback)


# ═══════════════════════════════════════════════════════════════════════════
# 5. AFTERNOON CONDITIONS (14:30 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_afternoon_conditions(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Afternoon sea conditions + tide info."""
    weather = await _get_weather_data(latitude, longitude, location_name)

    prompt = f"""Compose an AFTERNOON sea conditions update (max 600 chars) for Telegram.

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic_.
- Focus on: current sea state, wind changes, any developing weather systems.
- Include advisory: stay/return based on conditions.
- Start with ⛵ emoji.

WEATHER DATA:
{weather}

LOCATION: {location_name or f"{latitude:.2f}°N, {longitude:.2f}°E"}

Generate the update:"""

    return await _generate(prompt, f"⛵ *Afternoon Conditions*\n\n{weather}")


# ═══════════════════════════════════════════════════════════════════════════
# 6. EVENING FORECAST + TIPS (17:00 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_evening_forecast(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Evening forecast with a practical fishing tip."""
    weather = await _get_weather_data(latitude, longitude, location_name)
    user_memory = _get_user_memory(user_id)

    categories = [
        "fish preservation and quality tips",
        "best fishing techniques for the current season",
        "boat safety and maintenance",
        "government schemes and subsidies for fishermen",
        "market timing tips to get the best prices",
        "sustainable fishing practices",
        "net repair and equipment care",
    ]
    category = random.choice(categories)

    prompt = f"""Compose an EVENING message (max 800 chars) for Telegram with:
1. Brief evening weather/sea forecast
2. One practical tip about: {category}

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic_.
- Start with 🌆 emoji. Be warm and encouraging.

WEATHER DATA:
{weather}

USER INFO:
{user_memory if user_memory else "General fisherman"}

LOCATION: {location_name or f"{latitude:.2f}°N, {longitude:.2f}°E"}

Generate the message:"""

    return await _generate(prompt, "🌆 *Evening Update*\n\nWind down for the day. Rest well for tomorrow's catch! 🎣")


# ═══════════════════════════════════════════════════════════════════════════
# 7. NIGHT FISHING CONDITIONS (19:30 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_night_fishing_alert(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Night fishing conditions for those heading out at night."""
    weather = await _get_weather_data(latitude, longitude, location_name)

    prompt = f"""Compose a NIGHT fishing advisory (max 600 chars) for Telegram.

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic_.
- Focus on: night visibility, wind, wave conditions, moon phase if relevant.
- Safety reminders for night fishing (lights, communication, buddy system).
- Start with 🌊 emoji.

WEATHER DATA:
{weather}

LOCATION: {location_name or f"{latitude:.2f}°N, {longitude:.2f}°E"}

Generate the advisory:"""

    return await _generate(prompt, "🌊 *Night Conditions*\n\nEnsure lights are working. Fish in groups for safety. 🔦")


# ═══════════════════════════════════════════════════════════════════════════
# 8. NEXT DAY PREVIEW (22:00 IST)
# ═══════════════════════════════════════════════════════════════════════════

async def generate_next_day_preview(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Tomorrow's forecast preview + preparation tips."""
    weather = await _get_weather_data(latitude, longitude, location_name)
    ban_info = _check_active_bans(latitude, longitude)

    prompt = f"""Compose a NEXT DAY preview message (max 700 chars) for Telegram.

RULES:
- Write ENTIRELY in {_lang(language)} ({language}).
- Telegram Markdown: *bold*, _italic_.
- Focus on: tomorrow's expected conditions, what to prepare, best departure time.
- Mention any alerts or bans for tomorrow.
- Start with 📋 emoji. End with encouraging note.
{f"- UPCOMING BAN: {ban_info}" if ban_info else ""}

WEATHER FORECAST:
{weather}

LOCATION: {location_name or f"{latitude:.2f}°N, {longitude:.2f}°E"}

Generate the preview:"""

    return await _generate(prompt, "📋 *Tomorrow's Preview*\n\nPrepare your gear tonight. Early start recommended! 🌅")


# ── Legacy alias (used by bot.py /weather command) ───────────────────────

async def generate_fishing_tip(
    latitude: float, longitude: float,
    location_name: str = "", language: str = "en", user_id: str = "",
) -> str:
    """Generate a quick fishing tip (alias for evening forecast)."""
    return await generate_evening_forecast(
        latitude=latitude, longitude=longitude,
        location_name=location_name, language=language, user_id=user_id,
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _extract_text(content) -> str:
    """Normalize LLM output."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return str(content)


def _find_nearest_port(lat: float, lon: float) -> Optional[str]:
    """Find the nearest port/market name."""
    import math
    best_name = None
    best_dist = float("inf")
    for marker in FISHING_MARKERS:
        if marker.get("type") in ("harbor", "market"):
            dlat = lat - marker["lat"]
            dlon = lon - marker["lon"]
            dist = math.sqrt(dlat ** 2 + dlon ** 2)
            if dist < best_dist:
                best_dist = dist
                best_name = marker["name"]
    if best_dist > 2.0:
        return None
    if best_name:
        return best_name.split()[0]
    return None


def _get_nearby_spots(lat: float, lon: float, radius_deg: float = 2.0) -> str:
    """Get a text list of nearby fishing spots."""
    import math
    spots = []
    for marker in FISHING_MARKERS:
        dlat = lat - marker["lat"]
        dlon = lon - marker["lon"]
        dist = math.sqrt(dlat ** 2 + dlon ** 2)
        if dist <= radius_deg:
            dist_km = dist * 111
            spots.append(f"- {marker['name']} ({marker['type']}) - ~{dist_km:.0f}km away")
    return "\n".join(spots) if spots else "No known fishing spots nearby."


def _check_active_bans(lat: float, lon: float) -> str:
    """Check if any fishing bans are active near the location."""
    import math
    import time

    month = int(time.strftime("%m"))
    active_bans = []

    for area in RESTRICTED_AREAS:
        dlat = lat - area["lat"]
        dlon = lon - area["lon"]
        dist_km = math.sqrt(dlat ** 2 + dlon ** 2) * 111
        radius = area.get("radius_km", 200)

        if dist_km <= radius:
            desc = area["description"]
            if "June" in desc or "July" in desc:
                if month in (6, 7):
                    active_bans.append(desc)
            elif "April" in desc:
                if month in (4, 5, 6):
                    active_bans.append(desc)

    return "; ".join(active_bans) if active_bans else ""
