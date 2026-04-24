from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY=os.getenv("GEMINI_API_KEY")
LLM_MODEL=os.getenv("GEMINI_MODEL")

client = OpenAI(
    api_key=API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

embedding_model=os.getenv("GEMINI_EMBED_MODEL")

vector_db=QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="learning_nodejs_with_rag",
    embedding=embeddings_model
)




response = client.chat.completions.create(
    model="gemini-3-flash-preview",
    messages=[
        {   "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user",
            "content": "Explain to me how AI works"
        }
    ]
)