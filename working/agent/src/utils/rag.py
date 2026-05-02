"""
RAG (Retrieval-Augmented Generation) utility — replaces OpenSearch / AOSS.

Uses ChromaDB (local, persistent) as the vector store with sentence-transformers
for embeddings. MySQL `fish_knowledge` table is the source of truth; documents
are synced into ChromaDB on first use and when updated.

Usage:
    from src.utils.rag import search_knowledge
    results = search_knowledge("pomfret disease treatment", n_results=3)
"""
from __future__ import annotations
import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# ── ChromaDB client (lazy, persistent on disk) ────────────────────────────────
_chroma_client = None
_collection = None

CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "fish_knowledge"
EMBED_MODEL = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")  # fast, 80MB, runs locally


def _get_collection():
    """Return (or create) the ChromaDB collection, loading the embedding model once."""
    global _chroma_client, _collection
    if _collection is not None:
        return _collection

    try:
        import chromadb
        from chromadb.utils import embedding_functions

        _chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"[RAG] ChromaDB collection ready — {_collection.count()} docs")
    except Exception as e:
        logger.error(f"[RAG] Failed to initialise ChromaDB: {e}")
        _collection = None

    return _collection


def sync_from_mysql() -> int:
    """
    Pull all rows from MySQL fish_knowledge and upsert into ChromaDB.
    Call this once at startup or after adding new knowledge documents.
    Returns number of docs synced.
    """
    from src.utils.db import fetchall

    collection = _get_collection()
    if collection is None:
        return 0

    if collection.count() > 0:
        logger.info(f"[RAG] Collection already has {collection.count()} docs. Skipping sync.")
        return 0

    rows = fetchall("SELECT doc_id, title, content, topic, language, source FROM fish_knowledge")
    if not rows:
        logger.info("[RAG] No documents in fish_knowledge table yet.")
        return 0

    ids = [r["doc_id"] for r in rows]
    documents = [f"{r['title']}\n\n{r['content']}" for r in rows]
    metadatas = [
        {"topic": r["topic"], "title": r["title"], "language": r.get("language", "en"), "source": r.get("source", "")}
        for r in rows
    ]

    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    logger.info(f"[RAG] Synced {len(rows)} documents into ChromaDB.")
    return len(rows)


def search_knowledge(query: str, n_results: int = 3, topic: str = None, language: str = "en") -> List[Dict[str, Any]]:
    """
    Search the fish knowledge base using semantic similarity.

    Args:
        query:     Natural language query (e.g. "pomfret minimum legal size")
        n_results: Number of results to return
        topic:     Optional filter — 'species' | 'disease' | 'regulation' | 'technique'
        language:  Language filter (default 'en')

    Returns:
        List of dicts with keys: title, content, topic, source, distance
    """
    collection = _get_collection()

    # If ChromaDB not available or empty, fall back to MySQL FULLTEXT
    if collection is None or collection.count() == 0:
        return _mysql_fulltext_fallback(query, n_results)

    where = {}
    if topic:
        where["topic"] = topic

    try:
        query_params: Dict[str, Any] = {
            "query_texts": [query],
            "n_results": min(n_results, max(collection.count(), 1)),
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            query_params["where"] = where

        results = collection.query(**query_params)

        output = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            output.append({
                "title": meta.get("title", ""),
                "content": doc,
                "topic": meta.get("topic", ""),
                "source": meta.get("source", ""),
                "distance": round(dist, 4),
            })
        return output

    except Exception as e:
        logger.error(f"[RAG] ChromaDB query failed: {e}")
        return _mysql_fulltext_fallback(query, n_results)


def _mysql_fulltext_fallback(query: str, n_results: int) -> List[Dict[str, Any]]:
    """Fallback: MySQL FULLTEXT search when ChromaDB is unavailable or empty."""
    try:
        from src.utils.db import fetchall
        rows = fetchall(
            """SELECT title, content, topic, source,
                      MATCH(title, content) AGAINST (%s IN NATURAL LANGUAGE MODE) AS score
               FROM fish_knowledge
               WHERE MATCH(title, content) AGAINST (%s IN NATURAL LANGUAGE MODE)
               ORDER BY score DESC
               LIMIT %s""",
            (query, query, n_results),
        )
        return [
            {"title": r["title"], "content": r["content"], "topic": r["topic"], "source": r.get("source", ""), "distance": 0.0}
            for r in rows
        ]
    except Exception as e:
        logger.error(f"[RAG] MySQL fallback also failed: {e}")
        return []
