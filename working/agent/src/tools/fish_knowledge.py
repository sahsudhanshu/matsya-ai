"""
Tool: search_fish_knowledge
Searches the local RAG knowledge base (ChromaDB + MySQL) for fish species,
diseases, regulations, and fishing techniques.
"""
from __future__ import annotations
from langchain_core.tools import tool
from src.utils.rag import search_knowledge


@tool
def search_fish_knowledge(query: str, topic: str = "") -> str:
    """Search the fish knowledge base for information about fish species, diseases,
    fishing regulations, and fishing techniques.

    Use this tool when the user asks about:
    - Fish species identification, biology, or habitat
    - Fish diseases and treatments
    - Legal/minimum catch sizes and fishing regulations
    - Fishing techniques or best practices
    - Market value or nutritional info for fish

    Args:
        query: The search query in natural language (e.g. "minimum legal size for pomfret")
        topic: Optional filter — one of: species, disease, regulation, technique (leave blank for all)

    Returns:
        Relevant knowledge excerpts from the database.
    """
    results = search_knowledge(query=query, n_results=3, topic=topic or None)

    if not results:
        return "No relevant information found in the knowledge base for this query."

    parts = []
    for i, r in enumerate(results, 1):
        parts.append(
            f"[{i}] **{r['title']}** (topic: {r['topic']}, source: {r['source'] or 'internal'})\n"
            f"{r['content'][:600]}{'…' if len(r['content']) > 600 else ''}"
        )

    return "\n\n".join(parts)
