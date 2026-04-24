"""
rag_retriever.py -- Gemini Embeddings + AWS OpenSearch Serverless retriever

Used by rag_agent_integration.py at agent runtime.
Flow:
  1. Embed query with Gemini text-embedding-004 (768 dims)
  2. KNN search against AOSS index built by rag_setup.py
  3. Return ranked text chunks for the LangGraph agent
"""

import logging
import os
import time
from typing import Any, Dict, List, Optional

import boto3
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Config from env -------------------------------------------------------
_AOSS_ENDPOINT        = os.getenv("AOSS_ENDPOINT",   "https://REDACTED_AOSS_ENDPOINT.us-east-1.aoss.amazonaws.com")
_AOSS_REGION          = os.getenv("BEDROCK_REGION",   "us-east-1")
_AOSS_INDEX           = os.getenv("AOSS_INDEX_NAME",  "fish-gemini-index")
_GOOGLE_API_KEY       = os.getenv("GOOGLE_API_KEY",   "")
_GEMINI_EMBED         = os.getenv("GEMINI_EMBED_MODEL", "models/gemini-embedding-001")
# Minimum AOSS KNN score to consider a result relevant.
_RELEVANCE_THRESHOLD  = 0.62


def _aoss_client():
    """opensearch-py client authenticated with AWS4Auth (aoss service signing)."""
    from opensearchpy import OpenSearch, RequestsHttpConnection
    from requests_aws4auth import AWS4Auth

    host  = _AOSS_ENDPOINT.replace("https://", "").replace("http://", "")
    creds = boto3.Session().get_credentials().get_frozen_credentials()
    auth  = AWS4Auth(creds.access_key, creds.secret_key, _AOSS_REGION, "aoss",
                     session_token=creds.token)
    return OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=30,
    )


def _embed_query(query: str) -> List[float]:
    """Return a 768-dim Gemini embedding for a single query string."""
    import google.generativeai as genai
    genai.configure(api_key=_GOOGLE_API_KEY)
    result = genai.embed_content(
        model=_GEMINI_EMBED,
        content=query,
        task_type="retrieval_query",
    )
    return result["embedding"]


class BedrockRAGRetriever:
    """
    Retrieves relevant documents using Gemini embeddings + AOSS KNN search.

    Drop-in replacement for the previous Bedrock KB retriever —
    rag_agent_integration.py uses the same interface unchanged.
    """

    def __init__(self, kb_id: Optional[str] = None, region: Optional[str] = None):
        # kb_id / region kept for API compatibility; config comes from env
        self._os   = _aoss_client()
        self._index = _AOSS_INDEX
        logger.info(f"BedrockRAGRetriever (Gemini+AOSS) initialised. Index: {self._index}")


    def retrieve(self, query: str, top_k: int = 5) -> Dict[str, Any]:
        """
        Semantic KNN search over the AOSS index.

        Returns
        -------
        {
            "query": str,
            "documents": [
                {"rank": int, "score": float, "content": str, "source": str},
                ...
            ],
            "error": str | None,
        }
        """
        try:
            vec  = _embed_query(query)
            resp = self._os.search(
                index=self._index,
                body={
                    "size": top_k,
                    "query": {"knn": {"embedding": {"vector": vec, "k": top_k}}},
                    "_source": ["text", "source", "chunk_id"],
                },
            )
        except Exception as exc:
            logger.error(f"AOSS retrieve() failed: {exc}")
            return {"query": query, "documents": [], "error": str(exc)}

        docs = []
        for rank, hit in enumerate(resp["hits"]["hits"], 1):
            src = hit["_source"]
            docs.append({
                "rank":    rank,
                "score":   round(hit["_score"], 4),
                "content": src.get("text", "").strip(),
                "source":  src.get("source", ""),
            })

        short_q = query[:60] + "..." if len(query) > 60 else query
        logger.info(f"Retrieved {len(docs)} documents for query: '{short_q}'")
        return {"query": query, "documents": docs, "error": None}

    def get_context_string(self, query: str, top_k: int = 5) -> str:
        """
        Return documents formatted as a plain-text context block for the LLM.
        Returns empty string if no results OR if top score < relevance threshold.
        """
        result = self.retrieve(query, top_k=top_k)
        if result["error"] or not result["documents"]:
            return ""

        top_score = result["documents"][0]["score"]
        if top_score < _RELEVANCE_THRESHOLD:
            logger.info(
                f"[RAG] Dropping results — top score {top_score:.3f} < "
                f"threshold {_RELEVANCE_THRESHOLD} for query: '{query[:60]}'"
            )
            return ""

        parts = ["### Relevant Knowledge Base Excerpts"]
        for doc in result["documents"]:
            src = doc["source"] or "unknown"
            parts.append(f"\n**[{doc['rank']}] {src}** (score: {doc['score']})")
            parts.append(doc["content"])

        return "\n".join(parts)


# ── Query builder helpers -------------------------------------------------

class RAGQueryBuilder:
    """Builds targeted KB queries from agent-state context."""

    @staticmethod
    def build_fish_query(species: str) -> str:
        return f"{species} fish habitat seasons diet aquaculture disease farming fishing techniques"

    @staticmethod
    def build_disease_query(disease_name: str) -> str:
        return f"{disease_name} fish disease symptoms treatment prevention aquaculture"

    @staticmethod
    def build_regulation_query(region: str = "") -> str:
        base = "fishing regulations ban season government scheme subsidy"
        return f"{region} {base}".strip() if region else base

    @staticmethod
    def build_general_query(user_input: str) -> str:
        """Pass the raw user input -- Gemini embedding handles semantics."""
        return user_input[:1000]


# ── Logger helper ---------------------------------------------------------

class RAGLogger:
    """Structured logging for RAG retrieval events."""

    @staticmethod
    def log_retrieval(query: str, num_results: int, context_length: int) -> None:
        logger.info(
            f"[RAG] Retrieved {num_results} docs | context_len={context_length} | "
            f"query=\"{query[:80]}\""
        )

    @staticmethod
    def log_cache_hit(query: str) -> None:
        logger.debug(f"[RAG] Cache hit for query: '{query[:60]}'")


# ── Global singleton factory ----------------------------------------------

_retriever_instance: Optional[BedrockRAGRetriever] = None


def get_retriever(kb_id: Optional[str] = None) -> BedrockRAGRetriever:
    """Return (or create) the global BedrockRAGRetriever instance."""
    global _retriever_instance
    if _retriever_instance is None or (kb_id and kb_id != _retriever_instance.kb_id):
        _retriever_instance = BedrockRAGRetriever(kb_id=kb_id)
    return _retriever_instance


# ── CLI self-test ---------------------------------------------------------

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

    print("=== Gemini + AOSS RAG Retriever Self-Test ===")
    try:
        retriever = BedrockRAGRetriever()
    except Exception as exc:
        print(f"ERROR initialising retriever: {exc}")
        sys.exit(1)

    test_queries = [
        "Rohu fish habitat and breeding season",
        "fish disease symptoms treatment",
        "fishing regulations ban season India",
        "bait and lure for freshwater fishing",
    ]

    for q in test_queries:
        print(f"\nQuery: {q}")
        result = retriever.retrieve(q, top_k=3)
        if result["error"]:
            print(f"  ERROR: {result['error']}")
        else:
            for doc in result["documents"]:
                src = doc["source"].split("/")[-1] if doc["source"] else "N/A"
                print(f"  [{doc['rank']}] {src} | score={doc['score']}%")
                print(f"      {doc['content'][:120]}...")

    print("\n=== Self-Test Complete ===")
