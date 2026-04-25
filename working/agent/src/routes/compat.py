"""
Compatibility route - matches the existing frontend API shape for chat.

The frontend expects:
  POST /chat  → { chatId, response, timestamp }
  GET  /chat  → ChatMessage[]

This route auto-manages a default conversation per user and delegates
to the LangGraph agent.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from langchain_core.messages import AIMessage

from src.utils.auth import TokenPayload, verify_token
from src.memory.db_store import (
    create_conversation,
    list_conversations,
    get_conversation,
    get_messages,
    save_message,
    update_conversation,
)
from src.memory.manager import maybe_update_summary
from src.core.graph import graph

router = APIRouter()


def _extract_text(content) -> str:
    """Normalize AIMessage.content - Gemini 2.5 may return a list of blocks."""
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


# ── Request models ───────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    language: str | None = None
    latitude: float | None = None
    longitude: float | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create_default_conversation(user_id: str, language: str = "en"):
    """Reuse the most recent conversation or create one."""
    convs = list_conversations(user_id, limit=1)
    if convs:
        return convs[0]
    return create_conversation(user_id, title="Chat", language=language)


# ── POST /chat ───────────────────────────────────────────────────────────────

@router.post("")
async def send_chat(
    body: ChatRequest,
    user: TokenPayload = Depends(verify_token),
):
    language = body.language or "en"
    conv = _get_or_create_default_conversation(user.sub, language)
    conversation_id = conv["conversationId"]

    # Persist user message
    save_message(conversation_id, role="user", content=body.message)

    # Invoke the LangGraph agent
    initial_state = {
        "user_id": user.sub,
        "conversation_id": conversation_id,
        "selected_language": language,
        "human_input": body.message,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "messages": [],
        "tool_outputs": [],
    }
    print(f"DEBUG /chat: Invoking graph with selected_language: '{language}', location: ({body.latitude}, {body.longitude})")

    try:
        result = await graph.ainvoke(initial_state)
    except Exception as e:
        error_msg = f"I'm sorry, I encountered an error. Please try again. ({type(e).__name__})"
        save_message(conversation_id, role="assistant", content=error_msg)
        return {
            "chatId": conversation_id,
            "response": error_msg,
            "timestamp": __import__("time").strftime("%Y-%m-%dT%H:%M:%S.000Z", __import__("time").gmtime()),
        }

    # Language rejection
    if not result.get("language_accepted"):
        rejection = result.get("language_rejection", "Please use the selected language.")
        save_message(conversation_id, role="assistant", content=rejection)
        return {
            "chatId": conversation_id,
            "response": rejection,
            "timestamp": __import__("time").strftime("%Y-%m-%dT%H:%M:%S.000Z", __import__("time").gmtime()),
        }

    # Extract final AI response
    ai_content = ""
    for msg in reversed(result.get("messages", [])):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            ai_content = _extract_text(msg.content)
            break

    if not ai_content:
        ai_content = "I processed your request but couldn't generate a response. Please try again."

    # Strip any residual __UI__ markers from the text before saving
    idx = ai_content.find("__UI__")
    if idx != -1:
        ai_content = ai_content[:idx].strip()
    if not ai_content:
        ai_content = "I processed your request but couldn't generate a response. Please try again."

    saved = save_message(conversation_id, role="assistant", content=ai_content)

    # Update conversation
    msg_count = conv.get("messageCount", 0) + 2
    title = conv.get("title", "Chat")
    if title in ("Chat", "New Chat") and body.message:
        title = body.message[:60] + ("…" if len(body.message) > 60 else "")
    update_conversation(conversation_id, messageCount=msg_count, title=title)

    try:
        await maybe_update_summary(conversation_id)
    except Exception:
        pass

    return {
        "chatId": conversation_id,
        "response": ai_content,
        "timestamp": saved.get("timestamp", ""),
        "ui": {
            "map":     result.get("ui_map", False),
            "history": result.get("ui_history", False),
            "upload":  result.get("ui_upload", False),
            "mapLat":  result.get("map_lat"),
            "mapLon":  result.get("map_lon"),
        },
    }


# ── GET /chat ────────────────────────────────────────────────────────────────

@router.get("")
async def get_chat_history(
    limit: int = 30,
    user: TokenPayload = Depends(verify_token),
):
    """Return chat history in the format the frontend expects."""
    convs = list_conversations(user.sub, limit=5)

    history = []
    for conv in convs:
        msgs = get_messages(conv["conversationId"], limit=limit, ascending=True)

        # Pair user/assistant messages
        i = 0
        while i < len(msgs):
            user_msg = msgs[i]
            if user_msg.get("role") not in ("user", "human"):
                i += 1
                continue

            # Find the next assistant message
            assistant_msg = None
            for j in range(i + 1, len(msgs)):
                if msgs[j].get("role") in ("assistant", "ai"):
                    assistant_msg = msgs[j]
                    i = j + 1
                    break
            else:
                i += 1
                continue

            history.append({
                "chatId": user_msg.get("messageId", ""),
                "userId": user.sub,
                "message": user_msg.get("content", ""),
                "response": assistant_msg.get("content", ""),
                "timestamp": user_msg.get("timestamp", ""),
            })

    return history
