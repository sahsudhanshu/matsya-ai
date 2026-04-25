"""
MySQL store for Telegram subscriptions.

Table: telegram_subs (in MySQL schema)
  PK: telegramChatId (str)
  Attributes: userId, latitude, longitude, locationName, language,
              alertsEnabled, subscribedAt, updatedAt
"""
from __future__ import annotations
import time
from typing import Any, Dict, List, Optional

from src.utils.db import execute, fetchone, fetchall


def get_subscriber(telegram_chat_id: int) -> Optional[Dict[str, Any]]:
    """Get a single subscriber by Telegram chat ID."""
    return fetchone(
        "SELECT * FROM telegram_subs WHERE telegramChatId = %s",
        (str(telegram_chat_id),),
    )


def upsert_subscriber(
    telegram_chat_id: int,
    latitude: float,
    longitude: float,
    location_name: str = "",
    language: str = "en",
    user_id: str = "",
) -> Dict[str, Any]:
    """Create or update a subscriber."""
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    chat_id_str = str(telegram_chat_id)

    existing = get_subscriber(telegram_chat_id)
    subscribed_at = existing["subscribedAt"] if existing else now

    execute(
        """INSERT INTO telegram_subs 
           (telegramChatId, userId, latitude, longitude, locationName, language, alertsEnabled, subscribedAt, updatedAt)
           VALUES (%s, %s, %s, %s, %s, %s, 1, %s, %s)
           ON DUPLICATE KEY UPDATE
             userId = VALUES(userId), latitude = VALUES(latitude),
             longitude = VALUES(longitude), locationName = VALUES(locationName),
             language = VALUES(language), alertsEnabled = 1, updatedAt = VALUES(updatedAt)""",
        (chat_id_str, user_id or None, str(latitude), str(longitude),
         location_name, language, subscribed_at, now),
    )

    return {
        "telegramChatId": chat_id_str,
        "userId": user_id,
        "latitude": str(latitude),
        "longitude": str(longitude),
        "locationName": location_name,
        "language": language,
        "alertsEnabled": True,
        "subscribedAt": subscribed_at,
        "updatedAt": now,
    }


def set_alerts_enabled(telegram_chat_id: int, enabled: bool) -> None:
    """Toggle alerts on/off."""
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    execute(
        "UPDATE telegram_subs SET alertsEnabled = %s, updatedAt = %s WHERE telegramChatId = %s",
        (1 if enabled else 0, now, str(telegram_chat_id)),
    )


def delete_subscriber(telegram_chat_id: int) -> None:
    """Remove a subscriber."""
    execute(
        "DELETE FROM telegram_subs WHERE telegramChatId = %s",
        (str(telegram_chat_id),),
    )


def get_all_active_subscribers() -> List[Dict[str, Any]]:
    """Get all subscribers with alerts enabled."""
    return fetchall(
        "SELECT * FROM telegram_subs WHERE alertsEnabled = 1",
    )

