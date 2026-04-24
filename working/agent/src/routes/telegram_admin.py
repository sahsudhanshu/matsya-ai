"""
Telegram admin routes - test and manage alerts via HTTP.

  POST /telegram/test-alert       → send a test alert to a specific chat_id
  GET  /telegram/subscribers      → list all subscribers
  POST /telegram/trigger/{slot}   → manually trigger a specific alert slot
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.telegram.subscribers import get_all_active_subscribers, get_subscriber
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
from src.telegram.scheduler import (
    _send_telegram_message,
    send_predawn_alert,
    send_morning_alerts,
    send_midmorning_spots,
    send_noon_market,
    send_afternoon_conditions,
    send_evening_forecast,
    send_night_alert,
    send_next_day_preview,
)
from src.config.settings import TELEGRAM_BOT_TOKEN

router = APIRouter()

# Map of alert types for testing
ALERT_GENERATORS = {
    "predawn": generate_predawn_alert,
    "weather": generate_weather_alert,
    "spots": generate_best_spot_alert,
    "market": generate_market_update,
    "afternoon": generate_afternoon_conditions,
    "evening": generate_evening_forecast,
    "night": generate_night_fishing_alert,
    "nextday": generate_next_day_preview,
}

# Map of trigger slots for bulk dispatch
TRIGGER_SLOTS = {
    "predawn": send_predawn_alert,
    "morning": send_morning_alerts,
    "spots": send_midmorning_spots,
    "market": send_noon_market,
    "afternoon": send_afternoon_conditions,
    "evening": send_evening_forecast,
    "night": send_night_alert,
    "nextday": send_next_day_preview,
}


class TestAlertRequest(BaseModel):
    chat_id: str
    alert_type: str = "weather"  # predawn, weather, spots, market, afternoon, evening, night, nextday


@router.post("/test-alert")
async def test_alert(body: TestAlertRequest):
    """Send a test alert to a specific subscriber."""
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram not configured")

    sub = get_subscriber(int(body.chat_id))
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    generator = ALERT_GENERATORS.get(body.alert_type)
    if not generator:
        valid = ", ".join(ALERT_GENERATORS.keys())
        raise HTTPException(status_code=400, detail=f"Invalid alert_type. Use: {valid}")

    lat = float(sub.get("latitude", 0))
    lon = float(sub.get("longitude", 0))

    msg = await generator(
        latitude=lat, longitude=lon,
        location_name=sub.get("locationName", ""),
        language=sub.get("language", "en"),
        user_id=sub.get("userId", ""),
    )
    await _send_telegram_message(body.chat_id, msg)
    return {"success": True, "alert_type": body.alert_type, "message": msg}


@router.get("/subscribers")
async def list_subscribers():
    """List all active subscribers."""
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram not configured")
    subs = get_all_active_subscribers()
    return {"count": len(subs), "subscribers": subs}


@router.post("/trigger/{slot}")
async def trigger_slot(slot: str):
    """Manually trigger a specific alert slot for all subscribers."""
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram not configured")

    trigger_fn = TRIGGER_SLOTS.get(slot)
    if not trigger_fn:
        valid = ", ".join(TRIGGER_SLOTS.keys())
        raise HTTPException(status_code=400, detail=f"Invalid slot. Use: {valid}")

    await trigger_fn()
    return {"success": True, "message": f"{slot} alerts dispatched"}
