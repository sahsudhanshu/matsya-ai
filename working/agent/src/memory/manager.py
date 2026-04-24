"""
Memory manager - orchestrates short-term + long-term memory for the agent.

Short-term: Last N messages verbatim, older messages summarised.
Long-term: Facts / preferences extracted by the LLM and persisted.
"""
from __future__ import annotations
from typing import Dict, List, Optional, Tuple

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from src.config.settings import SHORT_TERM_MESSAGE_LIMIT
from src.memory.db_store import (
    get_messages,
    get_long_term_memory,
    get_conversation,
    update_conversation,
    update_long_term_memory,
    count_messages,
)


async def _call_bedrock_for_text(prompt: str) -> str:
    """Quick helper to call Claude/Gemini for a short text-generation task. Falls back gracefully."""
    try:
        import os
        from langchain_aws import ChatBedrockConverse
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        use_claude = os.getenv("USE_CLAUDE", "true").strip().lower() in ("1", "true", "yes")
        use_gemini = os.getenv("USE_GEMINI", "true").strip().lower() in ("1", "true", "yes")

        claude_model = None
        if use_claude:
            try:
                claude_model = ChatBedrockConverse(
                    model="global.anthropic.claude-sonnet-4-6",
                    region_name=os.getenv("BEDROCK_REGION", "us-east-1"),
                    temperature=0.3,
                    max_tokens=600,
                    bedrock_api_key=os.getenv("BEDROCK_API_KEY", "") or None,
                )
            except Exception:
                pass

        gemini_model = None
        if use_gemini:
            try:
                gemini_model = ChatGoogleGenerativeAI(
                    model=os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash"),
                    google_api_key=os.getenv("GOOGLE_API_KEY", ""),
                    max_output_tokens=600,
                    temperature=0.3,
                )
            except Exception:
                pass

        if claude_model and gemini_model:
            llm = claude_model.with_fallbacks([gemini_model])
        elif claude_model:
            llm = claude_model
        elif gemini_model:
            llm = gemini_model
        else:
            return "(Summary unavailable - LLM not configured)"

        resp = await llm.ainvoke([HumanMessage(content=prompt)])
        content = resp.content
        if isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block.get("text", ""))
            return "\n".join(parts)
        return str(content)
    except Exception:
        # LLM not available - return a simple fallback
        return "(Summary unavailable - LLM not configured)"


# ─────────────────────────────────────────────────────────────────────────────
# Short-term memory: build the message list fed to the LLM
# ─────────────────────────────────────────────────────────────────────────────

async def build_message_history(conversation_id: str) -> Tuple[list, Optional[str]]:
    """
    Returns:
        (recent_lc_messages, summary_text)
        - recent_lc_messages: LangChain BaseMessage list for the last N messages
        - summary_text: Summary of older messages (or None if all fit in window)
    """
    # Only fetch the messages we actually need (last N) instead of all 500
    recent_raw = get_messages(conversation_id, limit=SHORT_TERM_MESSAGE_LIMIT, ascending=True)
    recent_lc = _to_langchain_messages(recent_raw)

    # Grab existing summary from conversation metadata
    conv = get_conversation(conversation_id)
    summary = conv.get("summary") or None if conv else None

    # If we got a full page back and there's no summary yet, older messages exist
    # This only happens once per conversation (summary is cached after first generation)
    if len(recent_raw) >= SHORT_TERM_MESSAGE_LIMIT and not summary:
        total = count_messages(conversation_id)
        if total > SHORT_TERM_MESSAGE_LIMIT:
            all_msgs = get_messages(conversation_id, limit=total, ascending=True)
            older = all_msgs[:-SHORT_TERM_MESSAGE_LIMIT]
            if older:
                summary = await _summarize_messages(older)
                if conv:
                    update_conversation(conversation_id, summary=summary)

    return recent_lc, summary


async def maybe_update_summary(conversation_id: str) -> None:
    """Re-summarise if total messages exceeded the threshold since last summary.
    This runs as a background task after the stream response, so latency is not critical."""
    total = count_messages(conversation_id)
    if total <= SHORT_TERM_MESSAGE_LIMIT:
        return

    all_messages = get_messages(conversation_id, limit=total, ascending=True)
    older = all_messages[:-SHORT_TERM_MESSAGE_LIMIT]
    if not older:
        return
    summary = await _summarize_messages(older)
    update_conversation(conversation_id, summary=summary)


def _to_langchain_messages(raw: List[Dict]) -> list:
    """Convert DynamoDB message dicts → LangChain message objects."""
    result = []
    for m in raw:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role in ("user", "human"):
            result.append(HumanMessage(content=content))
        elif role in ("assistant", "ai"):
            result.append(AIMessage(content=content))
        elif role == "system":
            result.append(SystemMessage(content=content))
    return result


async def _summarize_messages(messages: List[Dict]) -> str:
    """Ask the LLM to produce a concise conversation summary."""
    transcript = "\n".join(
        f"{'User' if m.get('role') in ('user', 'human') else 'Assistant'}: {m.get('content', '')[:300]}"
        for m in messages
    )
    prompt = (
        "Summarise the following conversation between a fisherman and an AI assistant. "
        "Keep the summary under 200 words. Focus on: topics discussed, decisions made, "
        "any specific data mentioned (species, locations, dates). Write in plain language.\n\n"
        f"{transcript}\n\nSummary:"
    )
    return await _call_bedrock_for_text(prompt)


# ─────────────────────────────────────────────────────────────────────────────
# Long-term memory: extract and persist facts
# ─────────────────────────────────────────────────────────────────────────────

_PLACEHOLDER_PHRASES = {
    "no facts recorded yet", "no facts recorded yet.",
    "no new facts to record", "no new facts to record.",
    "no facts available", "no facts available.",
    "none", "n/a", "none.",
}

def _is_memory_placeholder(text: str) -> bool:
    """Return True if `text` is just a placeholder / empty memory string."""
    if not text:
        return True
    normalized = text.strip().lower()
    # Strip leading bullet markers (* or -)
    normalized = normalized.lstrip("*- ").strip()
    return normalized in _PLACEHOLDER_PHRASES


async def extract_and_update_long_term_memory(
    user_id: str,
    user_message: str,
    assistant_response: str,
) -> None:
    """
    Ask the LLM whether the latest exchange reveals new persistent facts
    about the user. If yes, merge them into existing long-term memory.
    """
    raw_existing = get_long_term_memory(user_id)
    existing = raw_existing if raw_existing and not _is_memory_placeholder(raw_existing) else "No facts about this user yet."

    prompt = (
        "You are a memory extraction system. Given the EXISTING facts about a fisherman user "
        "and their LATEST conversation exchange, determine if there are any NEW permanent facts "
        "worth remembering (e.g. home port, boat type, preferred fish, family details, experience).\n\n"
        f"EXISTING FACTS:\n{existing}\n\n"
        f"USER MESSAGE:\n{user_message}\n\n"
        f"ASSISTANT RESPONSE:\n{assistant_response}\n\n"
        "If there are new facts, output the COMPLETE updated fact list (merge old + new). "
        "If nothing new, output EXACTLY the word NONE and nothing else. "
        "Keep the format as a simple bullet list. Be concise.\n\n"
        "UPDATED FACTS:"
    )
    updated = await _call_bedrock_for_text(prompt)
    # Don't save placeholder/empty text back to DynamoDB
    if updated.strip() and not _is_memory_placeholder(updated):
        update_long_term_memory(user_id, updated.strip())
