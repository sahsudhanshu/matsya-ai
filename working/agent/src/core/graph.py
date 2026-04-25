"""
LangGraph graph definition — the core agent orchestration.

Graph flow:
  ┌──────────────┐
  │ language_guard│──rejected──► END (rejection message)
  └──────┬───────┘
         │ accepted
  ┌──────▼───────┐
  │ load_context  │  (memory + region + catch context)
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │    agent      │◄─────────┐
  └──────┬───────┘          │
         │                   │
    has_tool_calls?          │
      yes │    no            │
  ┌───────▼──────┐          │
  │ tool_executor │──────────┘
  └──────────────┘
         │ (no more tool calls)
  ┌──────▼───────┐
  │ memory_update │
  └──────┬───────┘
         │
        END
"""
from __future__ import annotations
from typing import Any, Dict, Literal, Optional, Tuple
import asyncio
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, END

# Primary LLM: Amazon Nova Pro via AWS Bedrock
try:
    from langchain_aws import ChatBedrockConverse as _ChatBedrock
    _BEDROCK_AVAILABLE = True
except ImportError:
    _BEDROCK_AVAILABLE = False

# Fallback LLM: Google Gemini (used when Bedrock is unavailable)
try:
    from langchain_google_genai import ChatGoogleGenerativeAI as _ChatGemini
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

from src.core.state import AgentState
from src.core.prompts import build_system_prompt
from src.memory.manager import build_message_history, extract_and_update_long_term_memory, _is_memory_placeholder
from src.memory.db_store import get_long_term_memory
from src.utils.languages import validate_language, get_rejection_message
from src.tools.weather import get_weather
from src.tools.catch_history import get_catch_history
from src.tools.specific_catch import get_catch_details
from src.tools.map_data import get_map_data
from src.tools.market_prices import get_market_prices
from src.tools.group_history import get_group_history
from src.tools.get_group_details import get_group_details
from src.tools.web_search import web_search
from src.tools.fishing_spots import get_nearby_fishing_spots
from src.tools.fish_weight import estimate_fish_weight
from src.tools.fish_knowledge import search_fish_knowledge

_INTENT_CLASSIFIER_MISSING_DEP_LOGGED = False

# Module-level classifier LLM singleton (same provider/key as the main agent)
_classifier_llm = None

def _get_classifier_llm():
    """Return a low-temperature LLM for intent classification.
    Reuses the same provider and API key as _get_llm() — no extra config needed.
    """
    global _classifier_llm
    if _classifier_llm is not None:
        return _classifier_llm

    import os

    use_claude = os.getenv("USE_CLAUDE", "true").strip().lower() in ("1", "true", "yes")
    use_gemini = os.getenv("USE_GEMINI", "true").strip().lower() in ("1", "true", "yes")

    claude_model = None
    if use_claude and _BEDROCK_AVAILABLE:
        claude_model = _ChatBedrock(
            model="global.anthropic.claude-sonnet-4-6",
            region_name=os.getenv("BEDROCK_REGION", "us-east-1"),
            temperature=0.0,
            max_tokens=2048,
        )

    gemini_model = None
    if use_gemini and _GEMINI_AVAILABLE:
        gemini_model = _ChatGemini(
            model=os.getenv("GEMINI_MODEL", "models/gemini-3-flash-preview"),
            google_api_key=os.getenv("GOOGLE_API_KEY", ""),
            temperature=0.0,
            max_output_tokens=2048,
        )

    if claude_model and gemini_model:
        _classifier_llm = claude_model.with_fallbacks([gemini_model])
    elif claude_model:
        _classifier_llm = claude_model
    elif gemini_model:
        _classifier_llm = gemini_model
    else:
        raise RuntimeError("No LLMs available. Check USE_CLAUDE, USE_GEMINI, and package installations.")

    return _classifier_llm

# Import RAG integration — ChromaDB local vector store (replaces OpenSearch/AOSS)
from src.utils.rag import search_knowledge as _search_knowledge  # noqa: F401 (used by tool)
RAG_AVAILABLE = True

# ── All tools the agent can invoke ───────────────────────────────────────────
TOOLS = [
    get_weather, get_catch_history, get_catch_details, get_map_data,
    get_market_prices, get_group_history, get_group_details, web_search,
    get_nearby_fishing_spots, estimate_fish_weight, search_fish_knowledge,
]

# ── LLM with tools bound ────────────────────────────────────────────────────
def _get_llm():
    import os

    use_claude = os.getenv("USE_CLAUDE", "true").strip().lower() in ("1", "true", "yes")
    use_gemini = os.getenv("USE_GEMINI", "true").strip().lower() in ("1", "true", "yes")

    claude_llm = None
    if use_claude and _BEDROCK_AVAILABLE:
        claude_llm = _ChatBedrock(
            model="global.anthropic.claude-sonnet-4-6",
            region_name=os.getenv("BEDROCK_REGION", "us-east-1"),
            temperature=0.7,
            max_tokens=4096,
            bedrock_api_key=os.getenv("BEDROCK_API_KEY", "") or None,
        ).bind_tools(TOOLS)

    gemini_llm = None
    if use_gemini and _GEMINI_AVAILABLE:
        gemini_llm = _ChatGemini(
            model=os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash"),
            google_api_key=os.getenv("GOOGLE_API_KEY", ""),
            temperature=0.7,
            max_output_tokens=2048,
            streaming=True,
        ).bind_tools(TOOLS)

    if claude_llm and gemini_llm:
        return claude_llm.with_fallbacks([gemini_llm])
    elif claude_llm:
        return claude_llm
    elif gemini_llm:
        return gemini_llm
    else:
        raise RuntimeError("No LLMs available to bind tools.")




# ─────────────────────────────────────────────────────────────────────────────
# Node: language_guard
# ─────────────────────────────────────────────────────────────────────────────

async def language_guard(state: AgentState) -> Dict[str, Any]:
    """Validate that the user's input matches the selected language."""
    text = state["human_input"]
    lang = state.get("selected_language", "en")
    accepted, reason = validate_language(text, lang)

    if not accepted:
        rejection = get_rejection_message(lang)
        if reason:
            rejection = f"{reason}\n\n{rejection}"
        return {
            "language_accepted": False,
            "language_rejection": rejection,
        }

    return {"language_accepted": True, "language_rejection": None}


# ─────────────────────────────────────────────────────────────────────────────
# Node: load_context
# ─────────────────────────────────────────────────────────────────────────────

async def load_context(state: AgentState) -> Dict[str, Any]:
    """Load memory, summary, and any relevant context into state."""
    conversation_id = state["conversation_id"]
    user_id = state["user_id"]
    lang = state.get("selected_language", "en")

    # Run independent IO in parallel to reduce latency
    import concurrent.futures, functools, asyncio as _aio
    loop = _aio.get_running_loop()

    history_task = _aio.ensure_future(build_message_history(conversation_id))
    ltm_task = loop.run_in_executor(None, get_long_term_memory, user_id)

    recent_messages, summary = await history_task
    ltm = await ltm_task

    # Filter out placeholder text so the LLM doesn't echo it in responses
    if _is_memory_placeholder(ltm):
        ltm = None

    # User location from browser GPS
    lat = state.get("latitude")
    lon = state.get("longitude")
    location_context = None
    if lat is not None and lon is not None:
        location_context = f"User's current GPS coordinates: {lat:.4f}°N, {lon:.4f}°E. Use these for weather lookups and location-aware responses."

    # Build system prompt with all context
    system_prompt = build_system_prompt(
        selected_language=lang,
        summary=summary,
        long_term_memory=ltm,
        location_context=location_context,
    )

    # Compose the full messages list
    messages = [SystemMessage(content=system_prompt)]
    messages.extend(recent_messages)
    messages.append(HumanMessage(content=state["human_input"]))

    return {
        "messages": messages,
        "summary": summary,
        "long_term_memory": ltm,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Node: rag_retrieval
# ─────────────────────────────────────────────────────────────────────────────

async def rag_retrieval(state: AgentState) -> Dict[str, Any]:
    """Sync fish_knowledge documents from MySQL into ChromaDB on first run."""
    try:
        from src.utils.rag import sync_from_mysql, _get_collection
        import asyncio as _aio
        loop = _aio.get_running_loop()
        count = await loop.run_in_executor(None, sync_from_mysql)
        return {"rag_documents_count": count, "rag_context": None, "rag_error": None}
    except Exception as e:
        import logging
        logging.warning(f"RAG sync failed (non-fatal): {e}")
        return {"rag_context": None, "rag_error": str(e), "rag_documents_count": 0}



# ─────────────────────────────────────────────────────────────────────────────# Node: intent_classifier
# ───────────────────────────────────────────────────────────────────────────────

_INTENT_CLASSIFIER_PROMPT = """
You are a classifier for a fisherman assistant app. Given the user's message, return ONLY a valid JSON object.

Message: "{message}"
-ignore which page is opened. Just focus on the actual message.


Rules:
- "map": true if the user wants to see a map, find fishing spots, navigate to a location, or asks about a specific place or country
- "history": true if the user wants to see their catch history, past catches, previous records, or past uploads
- "upload": true if the user wants to upload a photo, image, or picture (e.g. of a fish)
- "map_lat" / "map_lon": if map=true, resolve the latitude and longitude of the specific place mentioned in the message — this can be ANY location worldwide (a city, country, sea, ocean, coast, island, region, landmark). Use your geographic knowledge. Examples: Australia → (-25.2744, 133.7751), Arabian Sea → (14.5, 65.0), Mumbai → (19.0760, 72.8777), Bay of Bengal → (15.0, 87.0). Only return null when the user is asking about THEIR OWN current location (phrases like "show me on the map", "where am I", "near me", "my location") — in that case the app will use their GPS automatically.
Return ONLY a JSON object exactly like this example, no markdown, no explanation:
-if map is true also attach the coordinates of the place mentioned in the message. If no place is mentioned use the coordinates map_lat= {lat}, map_lon = {lon}
{{"map": false, "history": false, "upload": false, "map_lat": null, "map_lon": null}}
"""


def _strip_frontend_context_tags(message: str) -> str:
    """Remove leading frontend metadata tags like [page:map] and [mapPin:lat,lon]."""
    if not message:
        return ""
    cleaned = re.sub(r"^(?:\s*\[[^\]]+\]\s*)+", "", message)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _extract_map_pin_coordinates(message: str) -> Tuple[Optional[float], Optional[float]]:
    """Extract [mapPin:lat,lon] coordinates from frontend metadata, if present and valid."""
    if not message:
        return None, None

    match = re.search(
        r"\[\s*mapPin\s*:\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\]",
        message,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, None

    try:
        lat = float(match.group(1))
        lon = float(match.group(2))
    except (TypeError, ValueError):
        return None, None

    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None, None

    return lat, lon


async def intent_classifier(state: AgentState) -> Dict[str, Any]:
    """
    Lightweight node: uses the LLM to classify whether the user's message
    implies opening the map, viewing history, or uploading an image.
    Sets ui_map, ui_history, ui_upload (and map_lat/map_lon if applicable).
    """
    import json as _json
    import logging
    import asyncio
    import os

    human_input = state.get("human_input", "")
    lat, lon = _extract_map_pin_coordinates(human_input)
    human_input = _strip_frontend_context_tags(human_input)
    
    defaults: Dict[str, Any] = {
        "ui_map": False, "ui_history": False, "ui_upload": False,
        "map_lat": None, "map_lon": None,
    }

    try:
        from langchain_core.messages import HumanMessage as _HumanMessage
        
        # Grab our LLM which already has Claude -> Gemini fallback built-in
        classifier_llm = _get_classifier_llm()
       
        prompt = _INTENT_CLASSIFIER_PROMPT.format(
            message=human_input.replace('"', "'"),
            lat=lat,
            lon=lon,
        )
        msg_list = [_HumanMessage(content=prompt)]

        # Invoke it (LangChain will try Claude. If it throws an error, it easily runs Gemini)
        resp = await classifier_llm.ainvoke(msg_list)
        content = resp.content

        # Extract text from content — Gemini/Claude may return a list of content blocks
        if isinstance(content, str):
            raw = content
        elif isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block.get("text", ""))
            raw = "".join(parts)
        else:
            raw = str(content)
        raw = raw.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        # Normalize Python-style literals the LLM sometimes emits
        raw = raw.replace("True", "true").replace("False", "false").replace("None", "null")
        data = _json.loads(raw.strip())

        # If map=true but no coordinates extracted (user asked about their own location),
        # fall back to the user's GPS.
        map_lat = data.get("map_lat")
        map_lon = data.get("map_lon")

        # If map is requested and frontend provided mapPin, prefer it first.
        if data.get("map") and map_lat is None and lat is not None:
            map_lat = lat
            map_lon = lon

        if data.get("map") and map_lat is None:
            map_lat = state.get("latitude")
            map_lon = state.get("longitude")

        return {
            "ui_map":    bool(data.get("map", False)),
            "ui_history": bool(data.get("history", False)),
            "ui_upload":  bool(data.get("upload", False)),
            "map_lat":   float(map_lat) if map_lat is not None else None,
            "map_lon":   float(map_lon) if map_lon is not None else None,
        }
    except Exception as exc:
        logging.warning(f"[intent_classifier] failed: {exc}")
        return defaults


# ─────────────────────────────────────────────────────────────────────────────
# Node: agent
# ─────────────────────────────────────────────────────────────────────────────

async def agent(state: AgentState) -> Dict[str, Any]:
    """Invoke the LLM with the current message history."""
    import logging
    lang = state.get("selected_language", "en")

    messages = list(state["messages"])

    if state.get("rag_context"):
        system_prompt = build_system_prompt(
            selected_language=lang,
            summary=state.get("summary"),
            long_term_memory=state.get("long_term_memory"),
            region_context=state.get("region_context"),
            catch_context=state.get("catch_context"),
            location_context=None,
            rag_context=state.get("rag_context"),
        )
        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = SystemMessage(content=system_prompt)

    llm = _get_llm()
    response = await llm.ainvoke(messages)
    logging.debug(f"LLM response: content_len={len(response.content) if response.content else 0}")
    return {"messages": state["messages"] + [response]}


# ─────────────────────────────────────────────────────────────────────────────
# Node: tool_executor
# ─────────────────────────────────────────────────────────────────────────────

TOOL_MAP = {t.name: t for t in TOOLS}

async def tool_executor(state: AgentState) -> Dict[str, Any]:
    """Execute any tool calls made by the LLM."""
    messages = list(state["messages"])
    last_msg = messages[-1]

    if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
        return {"messages": messages}

    tool_outputs = state.get("tool_outputs", [])

    async def _run_tool(call: Dict[str, Any]) -> Dict[str, Any]:
        tool_name = call["name"]
        tool_args = dict(call["args"])

        # Auto-inject user_id for catch tools so the LLM doesn't need to guess it.
        if tool_name in ("get_catch_history", "get_catch_details", "get_group_history", "get_group_details"):
            tool_args["user_id"] = state.get("user_id", "")

        if tool_name not in TOOL_MAP:
            return {
                "call": call,
                "tool": tool_name,
                "args": tool_args,
                "result": f"⚠️ Unknown tool: {tool_name}",
            }

        try:
            result = await TOOL_MAP[tool_name].ainvoke(tool_args)
        except Exception as e:
            result = f"⚠️ Tool error: {e}"

        return {
            "call": call,
            "tool": tool_name,
            "args": tool_args,
            "result": str(result),
        }

    # Run independent tool calls concurrently to reduce end-to-end latency.
    tool_results = await asyncio.gather(*[_run_tool(call) for call in last_msg.tool_calls])

    for tr in tool_results:
        messages.append(ToolMessage(content=tr["result"], tool_call_id=tr["call"]["id"]))
        tool_outputs.append({"tool": tr["tool"], "args": tr["args"], "result": tr["result"][:500]})

    return {"messages": messages, "tool_outputs": tool_outputs}


# ─────────────────────────────────────────────────────────────────────────────
# Node: memory_update
# ─────────────────────────────────────────────────────────────────────────────

async def memory_update(state: AgentState) -> Dict[str, Any]:
    """Extract long-term memory from the latest exchange (fire-and-forget)."""
    messages = state["messages"]
    # Find the last AI text response
    ai_response = ""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            content = msg.content
       
            if isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, str):
                        parts.append(block)
                    elif isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                ai_response = "\n".join(parts)
            else:
                ai_response = str(content)
            break

    if ai_response:
        try:
            asyncio.create_task(
                extract_and_update_long_term_memory(
                    user_id=state["user_id"],
                    user_message=state["human_input"],
                    assistant_response=ai_response,
                )
            )
        except Exception:
            pass  # Don't fail the response if memory extraction fails

    return {}


# ─────────────────────────────────────────────────────────────────────────────
# Routing functions
# ─────────────────────────────────────────────────────────────────────────────

def route_language(state: AgentState) -> Literal["load_context", "end"]:
    """After language_guard: if rejected, go to END; else continue."""
    if state.get("language_accepted"):
        return "load_context"
    return "end"


def route_agent(state: AgentState) -> Literal["tool_executor", "memory_update"]:
    """After agent: if tool calls exist, execute them; else update memory and end."""
    messages = state.get("messages", [])
    if messages:
        last = messages[-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tool_executor"
    return "memory_update"


# ─────────────────────────────────────────────────────────────────────────────
# Build the graph
# ─────────────────────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """Construct and compile the LangGraph agent graph."""
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("language_guard", language_guard)
    workflow.add_node("load_context", load_context)
    workflow.add_node("intent_classifier", intent_classifier)
    if RAG_AVAILABLE:
        workflow.add_node("rag_retrieval", rag_retrieval)
    workflow.add_node("agent", agent)
    workflow.add_node("tool_executor", tool_executor)
    workflow.add_node("memory_update", memory_update)

    # Entry point
    workflow.set_entry_point("language_guard")

    # Edges
    workflow.add_conditional_edges("language_guard", route_language, {
        "load_context": "load_context",
        "end": END,
    })

    # load_context -> intent_classifier (always), then -> rag/agent
    workflow.add_edge("load_context", "intent_classifier")

    if RAG_AVAILABLE:
        # intent_classifier -> rag_retrieval -> agent
        workflow.add_edge("intent_classifier", "rag_retrieval")
        workflow.add_edge("rag_retrieval", "agent")
    else:
        # intent_classifier -> agent
        workflow.add_edge("intent_classifier", "agent")
    
    workflow.add_conditional_edges("agent", route_agent, {
        "tool_executor": "tool_executor",
        "memory_update": "memory_update",
    })
    workflow.add_edge("tool_executor", "agent")      # Loop back after tool execution
    workflow.add_edge("memory_update", END)

    return workflow.compile()


# Singleton graph instance
graph = build_graph()
