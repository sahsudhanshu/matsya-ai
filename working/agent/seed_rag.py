import os
import uuid
import time
from pathlib import Path
from pypdf import PdfReader
from dotenv import load_dotenv

load_dotenv()

from src.utils.db import execute
from src.utils.rag import sync_from_mysql

def seed_documents():
    docs_dir = Path("RAGDocument")
    if not docs_dir.exists():
        print(f"Directory {docs_dir} not found.")
        return

    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

    for filepath in docs_dir.iterdir():
        if filepath.is_file():
            title = filepath.name
            content = ""
            
            if filepath.suffix.lower() == ".md":
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
            elif filepath.suffix.lower() == ".pdf":
                try:
                    reader = PdfReader(str(filepath))
                    for page in reader.pages:
                        extracted = page.extract_text()
                        if extracted:
                            content += extracted + "\n"
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
                    continue
            else:
                continue
                
            if not content.strip():
                print(f"Skipping empty file: {filepath}")
                continue

            doc_id = f"doc_{uuid.uuid4().hex[:12]}"
            topic = "general"
            
            # Simple heuristic for topic
            lower_title = title.lower()
            if "disease" in lower_title:
                topic = "disease"
            elif "species" in lower_title or "fish" in lower_title:
                topic = "species"
            elif "regulat" in lower_title or "law" in lower_title:
                topic = "regulation"

            print(f"Inserting {title} ({len(content)} chars) as {topic}...")
            
            # Upsert into MySQL
            execute(
                """INSERT INTO fish_knowledge (doc_id, topic, title, content, language, source, createdAt, updatedAt)
                   VALUES (%s, %s, %s, %s, 'en', 'RAGDocument', %s, %s)
                """,
                (doc_id, topic, title, content, now, now)
            )

    print("All documents inserted into MySQL. Syncing to ChromaDB...")
    synced = sync_from_mysql()
    print(f"Sync complete. {synced} documents now in ChromaDB.")

if __name__ == "__main__":
    seed_documents()
