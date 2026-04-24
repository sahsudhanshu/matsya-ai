"""
Message routes - send a message (invokes LangGraph) and retrieve history.

  POST /conversations/{id}/messages   → send message
  GET  /conversations/{id}/messages   → get history
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import json
import asyncio
from pydantic import BaseModel
from langchain_core.messages import AIMessage, AIMessageChunk

from src.utils.auth import TokenPayload, verify_token
from src.memory.db_store import (
    get_conversation,
    get_messages,
    get_messages_page,
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


import re as _re

# Matches the __UI__{...} sentinel line the agent appends
_UI_LINE_RE = _re.compile(r'(?m)^__UI__(\{[^\n]+\})\s*$')

# Legacy fallback: stray JSON blobs the agent may leak in error cases
_JSON_BLOB_RE = _re.compile(
    r'\{\s*["\']?(?:map|history|upload|map_lat|map_lon)["\']?\s*:[^}]*\}'
)
_NOISE_PATTERNS = [
    _re.compile(r'No facts recorded yet\.?', _re.IGNORECASE),
    _re.compile(r'No new facts to record\.?', _re.IGNORECASE),
    _re.compile(r'UPDATED FACTS:\s*', _re.IGNORECASE),
]


def _extract_ui_json(text: str) -> tuple[dict, str]:
    """
    Extract the __UI__{...} sentinel from the agent's output.
    Uses str.find() so it works even if the model inserts whitespace between
    __UI__ and the JSON, or adds formatting around it.
    Returns (ui_dict, cleaned_text_without_the_sentinel_and_everything_after).
    Falls back to (empty dict, original text) if absent or malformed.
    """
    idx = text.find("__UI__")
    if idx != -1:
        cleaned = text[:idx].strip()
        # Pull the JSON object out of whatever follows __UI__
        m = _re.search(r'\{[^}]+\}', text[idx:])
        if m:
            try:
                data = json.loads(m.group(0))
                return data, cleaned
            except Exception:
                pass
        # Sentinel present but JSON malformed - still strip the line
        return {}, cleaned
    return {}, text


def _sanitise_agent_text(text: str) -> str:
    """Strip __UI__ sentinel, legacy JSON blobs, and memory-system noise."""
    # Cut from __UI__ onwards (primary path - normally _extract_ui_json already did this)
    idx = text.find("__UI__")
    if idx != -1:
        text = text[:idx]
    # Remove stray JSON blobs
    result = _JSON_BLOB_RE.sub("", text)
    for pattern in _NOISE_PATTERNS:
        result = pattern.sub("", result)
    return result.strip()


# ── Request / Response models ────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    message: str
    language: str | None = None   # override per-message (rare)
    latitude: float | None = None
    longitude: float | None = None


# ── Send message - invokes the full LangGraph pipeline ──────────────────────

@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    user: TokenPayload = Depends(verify_token),
):
    # ── Validate conversation ownership ──────────────────────────────────
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")

    language = body.language or conv.get("language", "en")

    # ── Persist user message ─────────────────────────────────────────────
    save_message(conversation_id, role="user", content=body.message)

    # ── Invoke the LangGraph agent ───────────────────────────────────────
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
    print(f"DEBUG /messages: Invoking graph with selected_language: '{language}', location: ({body.latitude}, {body.longitude})")

    try:
        result = await graph.ainvoke(initial_state)
    except Exception as e:
        # Save an error message so the user gets some feedback
        error_msg = f"I'm sorry, I encountered an error processing your request. Please try again. ({type(e).__name__})"
        save_message(conversation_id, role="assistant", content=error_msg)
        return {
            "success": False,
            "error": str(e),
            "response": {"role": "assistant", "content": error_msg},
        }

    # ── Check for language rejection ─────────────────────────────────────
    if not result.get("language_accepted"):
        rejection = result.get("language_rejection", "Please use the selected language.")
        save_message(conversation_id, role="assistant", content=rejection)
        return {
            "success": True,
            "response": {
                "role": "assistant",
                "content": rejection,
                "language_rejected": True,
            },
        }

    # ── Extract the final AI response ────────────────────────────────────
    ai_content = ""
    tool_calls_meta = []
    for msg in reversed(result.get("messages", [])):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            ai_content = _extract_text(msg.content)
            break

    # Collect tool calls for metadata
    for msg in result.get("messages", []):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls_meta.append({"name": tc["name"], "args": tc["args"]})

    if not ai_content:
        ai_content = "I processed your request but couldn't generate a response. Please try again."

    # ── Sanitise text, then build UI payload from intent classifier state ─
    ai_content = _sanitise_agent_text(ai_content)
    if not ai_content:
        ai_content = "I processed your request but couldn't generate a response. Please try again."

    # ── Persist assistant message ────────────────────────────────────────
    ui_payload = {
        "map":     bool(result.get("ui_map", False)),
        "history": bool(result.get("ui_history", False)),
        "upload":  bool(result.get("ui_upload", False)),
        "mapLat":  float(result["map_lat"]) if result.get("map_lat") is not None else None,
        "mapLon":  float(result["map_lon"]) if result.get("map_lon") is not None else None,
    }
    saved_msg = save_message(
        conversation_id,
        role="assistant",
        content=ai_content,
        tool_calls=tool_calls_meta if tool_calls_meta else None,
        metadata={"ui": ui_payload}
    )

    # ── Update conversation metadata ─────────────────────────────────────
    msg_count = conv.get("messageCount", 0) + 2  # user + assistant
    title = conv.get("title", "New Chat")
    if title == "New Chat" and body.message:
        # Auto-title from first message
        title = body.message[:60] + ("…" if len(body.message) > 60 else "")

    update_conversation(conversation_id, messageCount=msg_count, title=title)

    # ── Re-summarise if needed (async-ish, don't block response) ─────────
    try:
        await maybe_update_summary(conversation_id)
    except Exception:
        pass

    return {
        "success": True,
        "response": {
            "role": "assistant",
            "content": ai_content,
            "messageId": saved_msg.get("messageId"),
            "toolCalls": tool_calls_meta if tool_calls_meta else None,
        },
        "ui": ui_payload,
    }


# ── Stream message - SSE chunks of AI response ──────────────────────────────

@router.post("/{conversation_id}/messages/stream")
async def send_message_stream(
    conversation_id: str,
    body: SendMessageRequest,
    user: TokenPayload = Depends(verify_token),
):
    # ── Validate conversation ownership ──────────────────────────────────
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")

    language = body.language or conv.get("language", "en")

    # ── Persist user message ─────────────────────────────────────────────
    save_message(conversation_id, role="user", content=body.message)

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

    async def event_generator():
        try:
            ai_content_chunks: list[str] = []
            tools_called: list[str] = []
            _intent_state: dict = {}

            start_event = "{\"type\": \"start\"}"
            print(f"[SSE] → {start_event}")
            yield f"data: {start_event}\n\n"

            # Stream tokens from the "agent" node; also capture intent_classifier output.
            async for event in graph.astream_events(initial_state, version="v2"):
                kind = event["event"]
                node = event.get("metadata", {}).get("langgraph_node")

                if kind == "on_chain_end" and event.get("name") == "intent_classifier":
                    _intent_state = event["data"].get("output", {})

                elif kind == "on_chat_model_stream" and node == "agent":
                    chunk = event["data"]["chunk"]
                    if isinstance(chunk, AIMessageChunk) and chunk.content:
                        text = _extract_text(chunk.content)
                        if text:
                            ai_content_chunks.append(text)
                            yield f"data: {json.dumps({'type': 'chunk', 'text': text})}\n\n"

                elif kind == "on_tool_start" and node in ("agent", "tool_executor"):
                    tool_name = event.get("name")
                    tools_called.append(tool_name)
                    tool_event = json.dumps({'type': 'tool', 'name': tool_name})
                    print(f"[SSE] → {tool_event}")
                    yield f"data: {tool_event}\n\n"

            raw_content = "".join(ai_content_chunks)
            print(f"[SSE]   streamed {len(ai_content_chunks)} chunks, {len(raw_content)} chars total")

            if not raw_content:
                raw_content = "I processed your request but couldn't generate a text response."

            # Sanitise display text (strip any residual __UI__ markers)
            ai_content = _sanitise_agent_text(raw_content)
            if not ai_content:
                ai_content = "I processed your request but couldn't generate a text response."

            # UI payload comes exclusively from the intent classifier node output
            ui_payload = {
                "map":     bool(_intent_state.get("ui_map", False)),
                "history": bool(_intent_state.get("ui_history", False)),
                "upload":  bool(_intent_state.get("ui_upload", False)),
                "mapLat":  float(_intent_state["map_lat"]) if _intent_state.get("map_lat") is not None else None,
                "mapLon":  float(_intent_state["map_lon"]) if _intent_state.get("map_lon") is not None else None,
            }

            saved_msg = save_message(
                conversation_id,
                role="assistant",
                content=ai_content,
                tool_calls=None,
                metadata={"ui": ui_payload}
            )

            msg_count = conv.get("messageCount", 0) + 2
            title = conv.get("title", "New Chat")
            if title == "New Chat" and body.message:
                title = body.message[:60] + ("…" if len(body.message) > 60 else "")

            update_conversation(conversation_id, messageCount=msg_count, title=title)
            asyncio.create_task(maybe_update_summary(conversation_id))

            end_payload = {'type': 'end', 'messageId': saved_msg.get('messageId'), 'ui': ui_payload}
            end_event = json.dumps(end_payload)
            print(f"[SSE] → {end_event}")
            yield f"data: {end_event}\n\n"
        except Exception as e:
            error_msg = f"Error during streaming: {str(e)}"
            save_message(conversation_id, role="assistant", content=error_msg)
            err_event = json.dumps({'type': 'error', 'error': error_msg})
            print(f"[SSE] → {err_event}")
            yield f"data: {err_event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Get message history ─────────────────────────────────────────────────────

@router.get("/{conversation_id}/messages")
async def get_message_history(
    conversation_id: str,
    limit: int = 50,
    cursor: str | None = None,
    user: TokenPayload = Depends(verify_token),
):
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")

    page = get_messages_page(
        conversation_id,
        limit=limit,
        cursor=cursor,
        ascending=True,
    )

    return {
        "success": True,
        "messages": page.get("items", []),
        "nextCursor": page.get("nextCursor"),
        "hasMore": page.get("hasMore", False),
        "summary": conv.get("summary"),
    }
