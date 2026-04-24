"""
MySQL persistence for conversations, messages, and long-term memory.
Replaces the former DynamoDB store.
"""
from __future__ import annotations
import json
import time
import uuid
from typing import Any, Dict, List, Optional

from src.config.settings import SHORT_TERM_MESSAGE_LIMIT
from src.utils.db import execute, fetchone, fetchall


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())


# ─────────────────────────────────────────────────────────────────────────────
# Conversations
# ─────────────────────────────────────────────────────────────────────────────

def create_conversation(user_id: str, title: str = "New Chat", language: str = "en") -> Dict[str, Any]:
    conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
    now = _now_iso()
    execute(
        """INSERT INTO conversations (conversationId, userId, title, language, summary, messageCount, createdAt, updatedAt)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (conversation_id, user_id, title, language, "", 0, now, now),
    )
    return {
        "conversationId": conversation_id,
        "userId": user_id,
        "title": title,
        "language": language,
        "summary": "",
        "messageCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }


def list_conversations(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    return fetchall(
        "SELECT * FROM conversations WHERE userId = %s ORDER BY updatedAt DESC LIMIT %s",
        (user_id, limit),
    )


def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    return fetchone(
        "SELECT * FROM conversations WHERE conversationId = %s",
        (conversation_id,),
    )


def update_conversation(conversation_id: str, **kwargs) -> None:
    if not kwargs:
        return
    now = _now_iso()
    set_parts = [f"`{k}` = %s" for k in kwargs]
    set_parts.append("`updatedAt` = %s")
    values = list(kwargs.values()) + [now, conversation_id]
    execute(
        f"UPDATE conversations SET {', '.join(set_parts)} WHERE conversationId = %s",
        values,
    )


def delete_conversation(conversation_id: str) -> None:
    # ON DELETE CASCADE handles messages; explicit delete for safety
    execute("DELETE FROM messages WHERE conversationId = %s", (conversation_id,))
    execute("DELETE FROM conversations WHERE conversationId = %s", (conversation_id,))


# ─────────────────────────────────────────────────────────────────────────────
# Messages
# ─────────────────────────────────────────────────────────────────────────────

def save_message(
    conversation_id: str,
    role: str,
    content: str,
    tool_calls: Optional[List] = None,
    metadata: Optional[Dict] = None,
) -> Dict[str, Any]:
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    ms = str(uuid.uuid4().int % 1000).zfill(3)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + f".{ms}Z"

    tool_calls_json = json.dumps(tool_calls) if tool_calls else None
    metadata_json = json.dumps(metadata) if metadata else None

    execute(
        """INSERT INTO messages (messageId, conversationId, role, content, toolCalls, metadata, timestamp)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (message_id, conversation_id, role, content, tool_calls_json, metadata_json, now_iso),
    )

    # Increment message count on conversation
    execute(
        "UPDATE conversations SET messageCount = messageCount + 1, updatedAt = %s WHERE conversationId = %s",
        (_now_iso(), conversation_id),
    )

    item = {
        "conversationId": conversation_id,
        "messageId": message_id,
        "role": role,
        "content": content,
        "timestamp": now_iso,
    }
    if tool_calls:
        item["toolCalls"] = tool_calls
    if metadata:
        item["metadata"] = metadata
    return item


def get_messages(
    conversation_id: str,
    limit: int = 50,
    ascending: bool = True,
) -> List[Dict[str, Any]]:
    """Get messages for a conversation, sorted by timestamp."""
    order = "ASC" if ascending else "DESC"
    rows = fetchall(
        f"SELECT * FROM messages WHERE conversationId = %s ORDER BY timestamp {order} LIMIT %s",
        (conversation_id, limit),
    )
    # Parse JSON fields
    for row in rows:
        if row.get("toolCalls") and isinstance(row["toolCalls"], str):
            row["toolCalls"] = json.loads(row["toolCalls"])
        if row.get("metadata") and isinstance(row["metadata"], str):
            row["metadata"] = json.loads(row["metadata"])
    return rows


def get_messages_page(
    conversation_id: str,
    limit: int = 50,
    cursor: Optional[str] = None,
    ascending: bool = True,
) -> Dict[str, Any]:
    """Get a paginated message page using a timestamp cursor."""
    safe_limit = max(1, min(limit, 200))
    order = "ASC" if ascending else "DESC"

    if cursor:
        op = ">" if ascending else "<"
        rows = fetchall(
            f"SELECT * FROM messages WHERE conversationId = %s AND timestamp {op} %s ORDER BY timestamp {order} LIMIT %s",
            (conversation_id, cursor, safe_limit),
        )
    else:
        rows = fetchall(
            f"SELECT * FROM messages WHERE conversationId = %s ORDER BY timestamp {order} LIMIT %s",
            (conversation_id, safe_limit),
        )

    for row in rows:
        if row.get("toolCalls") and isinstance(row["toolCalls"], str):
            row["toolCalls"] = json.loads(row["toolCalls"])
        if row.get("metadata") and isinstance(row["metadata"], str):
            row["metadata"] = json.loads(row["metadata"])

    next_cursor = rows[-1]["timestamp"] if len(rows) == safe_limit else None
    return {
        "items": rows,
        "nextCursor": next_cursor,
        "hasMore": bool(next_cursor),
    }


def get_recent_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get the last SHORT_TERM_MESSAGE_LIMIT messages (verbatim) in chronological order."""
    rows = get_messages(conversation_id, limit=SHORT_TERM_MESSAGE_LIMIT, ascending=False)
    return list(reversed(rows))


def count_messages(conversation_id: str) -> int:
    row = fetchone(
        "SELECT COUNT(*) AS cnt FROM messages WHERE conversationId = %s",
        (conversation_id,),
    )
    return row["cnt"] if row else 0


# ─────────────────────────────────────────────────────────────────────────────
# Long-term memory
# ─────────────────────────────────────────────────────────────────────────────

def get_long_term_memory(user_id: str) -> Optional[str]:
    """Get aggregated long-term memory for a user."""
    row = fetchone("SELECT facts FROM memory WHERE userId = %s", (user_id,))
    return row["facts"] if row else None


def update_long_term_memory(user_id: str, facts: str) -> None:
    """Replace (upsert) the long-term memory blob for a user."""
    now = _now_iso()
    execute(
        """INSERT INTO memory (userId, facts, updatedAt) VALUES (%s, %s, %s)
           ON DUPLICATE KEY UPDATE facts = VALUES(facts), updatedAt = VALUES(updatedAt)""",
        (user_id, facts, now),
    )
