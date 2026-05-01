from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from dotenv import load_dotenv
import os
from openai import OpenAI
from pathlib import Path

load_dotenv(Path(__file__).parent.parent.parent / ".env")

api = os.getenv("GOOGLE_API_KEY")

print(api)

embeddings_model = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2"
)

vector_db = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="fish_data",
    embedding=embeddings_model
)


client = OpenAI(
    api_key=api,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)


def query_fish_rag(user_query: str, k: int = 10) -> str:
    """
    Query the fish knowledge RAG system with any question.

    Args:
        user_query (str): The question to ask about fish
        k (int): Number of similar documents to retrieve (default: 10)

    Returns:
        str: The AI response based on the retrieved context
    """
    print(f"rag chat called ------>")
    result = vector_db.similarity_search(query=user_query, k=k)


    formatted_result = []
    for res in result:
        entry = (
            f"page content {res.page_content} \n"
            f"page number {res.metadata.get('page')} \n"
            f"source : {res.metadata.get('source')} \n"
        )
        formatted_result.append(entry)

    context = "\n\n\n".join(formatted_result)


    SYSTEM_PROMPT = f"""
    You are a helpful AI assistant who answers users query based on the available context retrieved from a pdf file along with page_contents and page number.

    You should only answer the user based on the following context and navigate the user to open the right page number to know more.
    {context}
    """

    # Call OpenAI API
    response = client.chat.completions.create(
        model="gemini-2.5-flash",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": user_query
            }
        ]
    )

    return response.choices[0].message.content


if __name__ == "__main__":
    user_query = input("Ask Something about fish: ")
    response = query_fish_rag(user_query)
    print(response)