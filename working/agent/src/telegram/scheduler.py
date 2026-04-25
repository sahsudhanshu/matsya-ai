"""
Scheduler - sends 8 automated alerts per day to Telegram subscribers.

Schedule (IST = UTC+5:30):
  05:00  - Pre-dawn conditions & safety check
  07:00  - Morning weather forecast + fishing advisory
  09:30  - Mid-morning update + best spots
  12:00  - Noon market prices + conditions update
  14:30  - Afternoon sea conditions + tide info
  17:00  - Evening forecast + fishing tips
  19:30  - Night fishing conditions
  22:00  - Next day preview + overnight advisory

Uses APScheduler with AsyncIOScheduler that runs inside the FastAPI event loop.
"""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src.telegram.subscribers import get_all_active_subscribers
from src.telegram.alert_generator import (
    generate_predawn_alert,
    generate_weather_alert,
    generate_best_spot_alert,
    generate_market_update,
    generate_afternoon_conditions,
    generate_evening_forecast,
    generate_night_fishing_alert,
    generate_next_day_preview,
)
from src.config.settings import TELEGRAM_BOT_TOKEN

logger = logging.getLogger(__name__)

# Scheduler instance (created once, started/stopped via lifespan)
scheduler = AsyncIOScheduler()


async def _send_telegram_message(chat_id: str, text: str) -> None:
    """Send a message via Telegram Bot API (direct HTTP, no polling dependency)."""
    import httpx

    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set, skipping message")
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    # Split long messages (Telegram limit: 4096 chars)
    chunks = [text[i:i + 4000] for i in range(0, len(text), 4000)]

    async with httpx.AsyncClient(timeout=15) as client:
        for chunk in chunks:
            try:
                resp = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": chunk,
                    "parse_mode": "Markdown",
                })
                if resp.status_code != 200:
                    result = resp.json()
                    if result.get("error_code") == 403:
                        logger.info(f"User {chat_id} blocked bot, disabling")
                        from src.telegram.subscribers import set_alerts_enabled
                        set_alerts_enabled(int(chat_id), False)
                    else:
                        logger.error(f"Telegram API error for {chat_id}: {result}")
            except Exception as e:
                logger.error(f"Failed to send Telegram msg to {chat_id}: {e}")


async def _dispatch_alert(generator_fn, alert_name: str) -> None:
    """Generic dispatcher - runs the given generator for each active subscriber."""
    logger.info(f"Starting {alert_name} dispatch...")
    subscribers = get_all_active_subscribers()
    logger.info(f"Found {len(subscribers)} active subscribers for {alert_name}")

    for sub in subscribers:
        chat_id = sub["telegramChatId"]
        try:
            lat = float(sub.get("latitude", 0))
            lon = float(sub.get("longitude", 0))
            if lat == 0 and lon == 0:
                continue

            msg = await generator_fn(
                latitude=lat,
                longitude=lon,
                location_name=sub.get("locationName", ""),
                language=sub.get("language", "en"),
                user_id=sub.get("userId", ""),
            )
            await _send_telegram_message(chat_id, msg)
            await asyncio.sleep(1)  # rate limit between subscribers

        except Exception as e:
            logger.error(f"{alert_name} failed for {chat_id}: {e}")
            continue

    logger.info(f"{alert_name} dispatched to {len(subscribers)} subscribers")


# ── 8 Daily Alert Jobs ───────────────────────────────────────────────────────

async def send_predawn_alert():
    """05:00 IST - Pre-dawn conditions & safety."""
    await _dispatch_alert(generate_predawn_alert, "Pre-dawn alert")

async def send_morning_alerts():
    """07:00 IST - Morning weather forecast."""
    await _dispatch_alert(generate_weather_alert, "Morning weather")

async def send_midmorning_spots():
    """09:30 IST - Best fishing spots."""
    await _dispatch_alert(generate_best_spot_alert, "Mid-morning spots")

async def send_noon_market():
    """12:00 IST - Market prices & conditions."""
    await _dispatch_alert(generate_market_update, "Noon market update")

async def send_afternoon_conditions():
    """14:30 IST - Afternoon sea conditions."""
    await _dispatch_alert(generate_afternoon_conditions, "Afternoon conditions")

async def send_evening_forecast():
    """17:00 IST - Evening forecast + tips."""
    await _dispatch_alert(generate_evening_forecast, "Evening forecast")

async def send_night_alert():
    """19:30 IST - Night fishing conditions."""
    await _dispatch_alert(generate_night_fishing_alert, "Night fishing")

async def send_next_day_preview():
    """22:00 IST - Next day preview."""
    await _dispatch_alert(generate_next_day_preview, "Next day preview")


# ── Scheduler Setup ──────────────────────────────────────────────────────────

def setup_scheduler() -> None:
    """Configure scheduler with 8 daily alert jobs (times in UTC, targeting IST)."""

    # IST = UTC + 5:30
    jobs = [
        # (id, func, UTC hour, UTC minute, name)
        ("predawn_alert",        send_predawn_alert,        23, 30, "Pre-dawn (05:00 IST)"),
        ("morning_weather",      send_morning_alerts,        1, 30, "Morning weather (07:00 IST)"),
        ("midmorning_spots",     send_midmorning_spots,      4,  0, "Best spots (09:30 IST)"),
        ("noon_market",          send_noon_market,            6, 30, "Market update (12:00 IST)"),
        ("afternoon_conditions", send_afternoon_conditions,   9,  0, "Afternoon (14:30 IST)"),
        ("evening_forecast",     send_evening_forecast,      11, 30, "Evening (17:00 IST)"),
        ("night_fishing",        send_night_alert,           14,  0, "Night fishing (19:30 IST)"),
        ("next_day_preview",     send_next_day_preview,      16, 30, "Next day (22:00 IST)"),
    ]

    for job_id, func, hour, minute, name in jobs:
        scheduler.add_job(
            func,
            CronTrigger(hour=hour, minute=minute),
            id=job_id,
            name=name,
            replace_existing=True,
        )

    logger.info(
        "Alert scheduler configured - 8 messages/day:\n"
        "  05:00 IST  Pre-dawn conditions\n"
        "  07:00 IST  Morning weather\n"
        "  09:30 IST  Best fishing spots\n"
        "  12:00 IST  Market prices\n"
        "  14:30 IST  Afternoon conditions\n"
        "  17:00 IST  Evening forecast\n"
        "  19:30 IST  Night fishing\n"
        "  22:00 IST  Next day preview"
    )


def start_scheduler() -> None:
    """Start the scheduler (call after setup)."""
    if not scheduler.running:
        setup_scheduler()
        scheduler.start()
        logger.info("Alert scheduler started - 8 daily messages")


def stop_scheduler() -> None:
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Alert scheduler stopped")
