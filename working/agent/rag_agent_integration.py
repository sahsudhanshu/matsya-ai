"""
rag_agent_integration.py -- LangGraph integration for Bedrock Knowledge Base RAG

Provides:
  create_rag_tool()            -- LangChain Tool the agent can call on-demand
  retrieve_rag_context_async() -- LangGraph node that injects KB context into state
"""

import logging
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from langchain_core.tools import tool

from rag_retriever import BedrockRAGRetriever, RAGQueryBuilder, RAGLogger, get_retriever

load_dotenv()
logger = logging.getLogger(__name__)

# ── Species / disease topic gate ------------------------------------------
# RAG is only invoked when the query mentions one of the 31 ML species or
# a fish disease/treatment keyword.
_SPECIES_KEYWORDS: frozenset = frozenset({
    # The 31 ML-model species (canonical names + common aliases)
    "bangus", "milkfish",
    "big head carp", "bighead carp",
    "black spotted barb",
    "catfish", "magur", "mangur", "singhi",
    "climbing perch", "kawai",
    "fourfinger threadfin", "rawas",
    "freshwater eel", "eel", "baam",
    "glass perchlet",
    "goby",
    "goldfish", "gold fish",
    "gourami",
    "grass carp",
    "green spotted puffer", "puffer fish",
    "indian carp", "rohu", "catla", "mrigal", "labeo",
    "indo-pacific tarpon", "tarpon", "oxeye",
    "jaguar guapote",
    "janitor fish",
    "knifefish", "featherback",
    "pipefish",
    "mosquito fish", "gambusia",
    "mudfish", "snakehead", "murrel", "shol",
    "mullet",
    "pangasius", "basa",
    "perch",
    "scat fish",
    "silver barb",
    "silver carp",
    "silver perch",
    "tenpounder", "ladyfish",
    "tilapia",
    # Disease keywords (DISEASES.pdf is in the index)
    "disease", "infection", "bacteria", "bacterial", "fungal",
    "parasite", "parasitic", "viral", "sick fish", "dying fish",
    "fin rot", "ulcer", "lesion", "symptom", "aeromoniasis",
    "saprolegnia", "white tail", "red disease", "gill disease",
})


def _mentions_fish_topic(text: str) -> bool:
    """Return True if the text mentions a known species or disease keyword."""
    lower = text.lower()
    return any(kw in lower for kw in _SPECIES_KEYWORDS)


# ── Global retriever (lazy init) ------------------------------------------

_retriever: Optional[BedrockRAGRetriever] = None


def _get_retriever() -> BedrockRAGRetriever:
    global _retriever
    if _retriever is None:
        _retriever = get_retriever()
    return _retriever


# ── LangChain Tool --------------------------------------------------------

def create_rag_tool():
    """
    Returns a LangChain @tool that the LLM can invoke to search the Bedrock
    Knowledge Base for fish/fishing/disease/regulation information.

    The tool is added to TOOLS in graph.py and the LLM decides when to call it.
    """

    @tool
    def fish_knowledge_search(query: str) -> str:
        """
        Search the fish knowledge base for information about fish species,
        aquaculture, diseases, fishing techniques, regulations, or government
        schemes. Use this whenever the user asks about specific fish species,
        fish diseases, fishing regulations, or aquaculture practices.

        Args:
            query: A search query (in English) describing what to look up.

        Returns:
            Formatted knowledge base excerpts most relevant to the query.
        """
        try:
            retriever = _get_retriever()
            context = retriever.get_context_string(query, top_k=4)
            if not context:
                return "No relevant information found in the knowledge base for this query."
            RAGLogger.log_retrieval(query=query, num_results=context.count("**["), context_length=len(context))
            return context
        except Exception as exc:
            logger.warning(f"[fish_knowledge_search] failed: {exc}")
            return f"Knowledge base search failed: {exc}"

    return fish_knowledge_search


# ── LangGraph node (automatic context injection) --------------------------

async def retrieve_rag_context_async(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: automatically retrieve KB context before the agent LLM call.

    Determines the best search query from the agent state, retrieves documents,
    and injects a rag_context string into the state so the system prompt can
    include relevant knowledge without waiting for the LLM to request it.

    Returns an updated state dict with:
        rag_context          -- formatted KB excerpt string (injected into prompt)
        rag_documents_count  -- number of documents retrieved
        rag_error            -- error string or None
    """
    human_input = state.get("human_input", "")

    # Topic gate - only invoke RAG for fish/disease-related queries
    if not _mentions_fish_topic(human_input):
        return {"rag_context": None, "rag_documents_count": 0, "rag_error": None}

    # Build a focused search query
    detected_species = state.get("detected_species")
    if detected_species:
        query = RAGQueryBuilder.build_fish_query(detected_species)
        logger.info(f"[rag_retrieval] Species query: {query[:80]}")
    else:
        query = RAGQueryBuilder.build_general_query(human_input)
        logger.info(f"[rag_retrieval] General query: {query[:80]}")

    try:
        retriever = _get_retriever()
        context   = retriever.get_context_string(query, top_k=3)
        doc_count = context.count("**[")

        RAGLogger.log_retrieval(
            query=query,
            num_results=doc_count,
            context_length=len(context),
        )

        return {
            "rag_context":         context if context else None,
            "rag_documents_count": doc_count,
            "rag_error":           None,
        }

    except ValueError as exc:
        # KB not configured - silently skip
        logger.debug(f"RAG not available (no KB ID): {exc}")
        return {"rag_context": None, "rag_documents_count": 0, "rag_error": str(exc)}

    except Exception as exc:
        logger.warning(f"RAG retrieval failed: {exc}")
        return {"rag_context": None, "rag_documents_count": 0, "rag_error": str(exc)}
