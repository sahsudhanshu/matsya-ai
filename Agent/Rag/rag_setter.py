from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_qdrant import QdrantVectorStore
import os





from dotenv import load_dotenv
from pathlib import Path


load_dotenv(Path(__file__).parent.parent.parent / ".env")
pdf_path =Path(__file__).parent / "DISEASES.pdf"

loader=PyPDFLoader(file_path=pdf_path)
docs =loader.load()

text_splitter=RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=400
)


chunks = text_splitter.split_documents(documents=docs)



embeddings_model = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2"
)

try:
    vector_store = QdrantVectorStore.from_existing_collection(
        url="http://localhost:6333",
        collection_name="fish_data",
        embedding=embeddings_model
    )
    vector_store.add_documents(documents=chunks)
    print("Documents added to existing collection")
except:
    vector_store = QdrantVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings_model,
        url="http://localhost:6333",
        collection_name="fish_data"
    )
    print("New collection created and indexed")



