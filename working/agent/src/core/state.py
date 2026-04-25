"""
LangGraph agent state - TypedDict that flows through every node.
"""
from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional, TypedDict

from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """
    Accumulated state passed through the LangGraph graph.
    """
    # ── Identifiers ──────────────────────────────────────────────────────────
    user_id: str
    conversation_id: str

    # ── Language ─────────────────────────────────────────────────────────────
    selected_language: str                 # e.g. "hi", "en", "ta" …
    language_accepted: bool                # set by language_guard node
    language_rejection: Optional[str]      # message to return if rejected

    # ── Messages ─────────────────────────────────────────────────────────────
    messages: List[BaseMessage]            # full chat history fed to the LLM
    human_input: str                       # latest user text

    # ── User location (GPS from browser) ──────────────────────────────────────
    latitude: Optional[float]              # user's current latitude
    longitude: Optional[float]             # user's current longitude

    # ── Context (injected before agent) ──────────────────────────────────────
    summary: Optional[str]                 # summary of older messages
    long_term_memory: Optional[str]        # persisted facts / preferences
    region_context: Optional[str]          # nearby ocean zones, markers
    catch_context: Optional[str]           # recent catch history snippet
    
    # ── RAG Knowledge Base Context ───────────────────────────────────────────
    rag_context: Optional[str]             # Retrieved knowledge from Bedrock KB
    rag_query: Optional[str]               # The query used for RAG retrieval
    rag_documents_count: int               # Number of documents retrieved
    rag_query_type: Optional[str]          # Type of query: 'species', 'policy', 'general'
    detected_species: Optional[str]        # Fish species detected in user message
    rag_error: Optional[str]               # Error message if RAG retrieval failed

    # ── UI action hints (set by intent_classifier node) ────────────────────
    ui_map: bool                           # true → open map view in frontend
    ui_history: bool                       # true → open catch history in frontend
    ui_upload: bool                        # true → open upload dialog in frontend
    map_lat: Optional[float]               # map centre latitude (when ui_map=True)
    map_lon: Optional[float]               # map centre longitude (when ui_map=True)

    # ── Tool outputs ─────────────────────────────────────────────────────────
    tool_outputs: List[Dict[str, Any]]     # aggregated tool results

    # ── Control flow ─────────────────────────────────────────────────────────
    next_action: Literal["continue", "end"]
