"""
Tool: search_fish_knowledge
Searches the RAG knowledge base (QdrantVectorStore) for fish species,
diseases, regulations, and fishing techniques.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from langchain_core.tools import tool
from Rag.rag_chat import query_fish_rag



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
        Relevant knowledge excerpts from the RAG database.
    """
    try:
        # Query the RAG system with the fish knowledge base
        result = query_fish_rag(user_query=query, k=10)

        if not result:
            return "No relevant information found in the knowledge base for this query."

        return result

    except Exception as e:
        return f"Error querying fish knowledge base: {str(e)}"


if __name__ == "__main__":
    # Test the function
    test_query = "What are the characteristics of Indian Carp?"
    result = search_fish_knowledge(test_query)
    print(result)
