"""
rag_setup.py  --  Gemini Embeddings + AWS OpenSearch Serverless RAG Setup

Architecture:
  S3 (source docs) ──► local parse/chunk ──► Gemini text-embedding-004
                                                    │
                               AWS OpenSearch Serverless (AOSS) ◄─────┘

Run once to build the index:
    python rag_setup.py --ingest
    python rag_setup.py --ingest --local   # use local RAGDocument/ dir instead of S3

Query test:
    python rag_setup.py --query "Rohu fish disease treatment"
"""

import argparse
import io
import json
import logging
import os
import sys
import time
from typing import List, Dict, Any, Optional

import boto3
from botocore.config import Config as BotocoreConfig
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Config ----------------------------------------------------------------
AOSS_ENDPOINT  = os.getenv("AOSS_ENDPOINT",  "https://REDACTED_AOSS_ENDPOINT.us-east-1.aoss.amazonaws.com")
AOSS_REGION    = os.getenv("BEDROCK_REGION",  "us-east-1")
AOSS_INDEX     = os.getenv("AOSS_INDEX_NAME", "fish-gemini-index")
S3_BUCKET      = os.getenv("BEDROCK_S3_BUCKET", "REDACTED_S3_BUCKET")
S3_PREFIX      = os.getenv("BEDROCK_S3_PREFIX", "rag-docs")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_EMBED   = os.getenv("GEMINI_EMBED_MODEL", "models/gemini-embedding-001")
VECTOR_DIM     = 3072  # gemini-embedding-001 output dims
CHUNK_SIZE     = 2000  # chars per chunk
CHUNK_OVERLAP  = 200   # chars overlap between consecutive chunks


# ── Gemini embedding helper -----------------------------------------------

def embed_texts(texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
    """Embed a list of texts with Gemini text-embedding-004. Returns list of 768-dim vectors."""
    import google.generativeai as genai
    genai.configure(api_key=GOOGLE_API_KEY)

    embeddings = []
    batch_size = 20  # Gemini free tier: 100 req/min; batch conservatively
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        result = genai.embed_content(
            model=GEMINI_EMBED,
            content=batch,
            task_type=task_type,
        )
        # result["embedding"] is a list of lists when batched
        vecs = result["embedding"]
        if isinstance(vecs[0], float):  # single item returned flat
            vecs = [vecs]
        embeddings.extend(vecs)
        if i + batch_size < len(texts):
            time.sleep(0.6)  # stay under rate limit
    return embeddings


# ── Text chunking ---------------------------------------------------------

def chunk_text(text: str, source: str) -> List[Dict[str, str]]:
    """Split text into overlapping chunks. Returns list of {text, source, chunk_id}."""
    chunks = []
    start = 0
    idx = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append({"text": chunk, "source": source, "chunk_id": f"{source}#{idx}"})
            idx += 1
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


# ── Document parsing ------------------------------------------------------

def parse_markdown(content: bytes, filename: str) -> List[Dict[str, str]]:
    return chunk_text(content.decode("utf-8", errors="replace"), filename)


def parse_pdf(content: bytes, filename: str) -> List[Dict[str, str]]:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(content))
        full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return chunk_text(full_text, filename)
    except Exception as exc:
        logger.warning(f"PDF parse error for {filename}: {exc}")
        return []


def load_docs_from_s3() -> List[Dict[str, str]]:
    """Download and parse all files from S3 rag-docs prefix."""
    s3 = boto3.client("s3", region_name=AOSS_REGION)
    resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=S3_PREFIX + "/")
    all_chunks = []
    for obj in resp.get("Contents", []):
        key = obj["Key"]
        filename = key.split("/")[-1]
        if not filename or filename.startswith("."):
            continue
        logger.info(f"  Downloading s3://{S3_BUCKET}/{key}")
        body = s3.get_object(Bucket=S3_BUCKET, Key=key)["Body"].read()
        if filename.lower().endswith(".pdf"):
            chunks = parse_pdf(body, filename)
        else:
            chunks = parse_markdown(body, filename)
        logger.info(f"    → {len(chunks)} chunks from {filename}")
        all_chunks.extend(chunks)
    return all_chunks


def load_docs_from_local(local_dir: str) -> List[Dict[str, str]]:
    """Parse all files from a local directory."""
    import pathlib
    all_chunks = []
    for path in sorted(pathlib.Path(local_dir).iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        logger.info(f"  Reading {path.name}")
        body = path.read_bytes()
        if path.suffix.lower() == ".pdf":
            chunks = parse_pdf(body, path.name)
        else:
            chunks = parse_markdown(body, path.name)
        logger.info(f"    → {len(chunks)} chunks from {path.name}")
        all_chunks.extend(chunks)
    return all_chunks


# ── AOSS index management -------------------------------------------------

def _aoss_client():
    """Return opensearch-py client authenticated with AWS4Auth (AOSS service)."""
    from opensearchpy import OpenSearch, RequestsHttpConnection
    from requests_aws4auth import AWS4Auth

    host   = AOSS_ENDPOINT.replace("https://", "").replace("http://", "")
    creds  = boto3.Session().get_credentials().get_frozen_credentials()
    auth   = AWS4Auth(creds.access_key, creds.secret_key, AOSS_REGION, "aoss",
                      session_token=creds.token)
    return OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=60,
    )


def create_index(client=None) -> None:
    """Create (or skip if exists) the 768-dim KNN index for Gemini embeddings."""
    if client is None:
        client = _aoss_client()

    if client.indices.exists(index=AOSS_INDEX):
        logger.info(f"Index '{AOSS_INDEX}' already exists — skipping")
        return

    body = {
        "settings": {"index.knn": True},
        "mappings": {
            "properties": {
                "embedding": {
                    "type": "knn_vector",
                    "dimension": VECTOR_DIM,
                    "method": {
                        "engine":     "faiss",
                        "space_type": "l2",
                        "name":       "hnsw",
                        "parameters": {"ef_construction": 512, "m": 16},
                    },
                },
                "text":     {"type": "text"},
                "source":   {"type": "keyword"},
                "chunk_id": {"type": "keyword"},
            }
        },
    }
    resp = client.indices.create(index=AOSS_INDEX, body=body)
    if resp.get("acknowledged"):
        logger.info(f"✅ Index '{AOSS_INDEX}' created (dim={VECTOR_DIM})")
    else:
        raise RuntimeError(f"Index creation not acknowledged: {resp}")


def bulk_index(chunks: List[Dict[str, str]], embeddings: List[List[float]], client=None) -> int:
    """Bulk-index chunk documents with their embeddings. Returns count indexed."""
    if client is None:
        client = _aoss_client()

    ops = []
    for chunk, vec in zip(chunks, embeddings):
        ops.append({"index": {"_index": AOSS_INDEX}})  # AOSS: no _id in bulk ops
        ops.append({"text": chunk["text"], "source": chunk["source"],
                    "chunk_id": chunk["chunk_id"], "embedding": vec})

    # AOSS bulk — send in batches (3072-dim vectors are large; keep batches small)
    total = 0
    batch_size = 25
    for i in range(0, len(ops), batch_size * 2):
        batch = ops[i : i + batch_size * 2]
        resp  = client.bulk(body=batch)
        errors = [item for item in resp.get("items", []) if "error" in item.get("index", {})]
        indexed = len(batch) // 2 - len(errors)
        total  += indexed
        if errors:
            sample = errors[0]["index"]["error"]
            logger.warning(f"  {len(errors)} indexing errors in batch — sample: {sample}")
        logger.info(f"  Indexed {total} documents so far...")

    return total


# ── Main ingestion pipeline -----------------------------------------------

def run_ingestion(use_local: bool = False) -> None:
    logger.info("=" * 60)
    logger.info("RAG Ingestion — Gemini Embeddings + OpenSearch Serverless")
    logger.info("=" * 60)

    if not GOOGLE_API_KEY:
        logger.error("GOOGLE_API_KEY is not set in .env")
        sys.exit(1)

    # 1. Connect to AOSS
    logger.info("\n[1] Connecting to AOSS collection...")
    client = _aoss_client()
    logger.info(f"    Endpoint: {AOSS_ENDPOINT}")

    # 2. Create index
    logger.info(f"\n[2] Creating index '{AOSS_INDEX}' ({VECTOR_DIM} dims)...")
    create_index(client)
    time.sleep(10)  # AOSS index propagation

    # 3. Load documents
    logger.info("\n[3] Loading documents...")
    if use_local:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        rag_dir    = os.path.join(script_dir, "RAGDocument")
        chunks     = load_docs_from_local(rag_dir)
    else:
        chunks = load_docs_from_s3()

    logger.info(f"\n    Total chunks: {len(chunks)}")
    if not chunks:
        logger.error("No chunks found. Check S3 bucket or local RAGDocument/.")
        sys.exit(1)

    # 4. Generate embeddings
    logger.info(f"\n[4] Embedding {len(chunks)} chunks with Gemini ({GEMINI_EMBED})...")
    texts      = [c["text"] for c in chunks]
    embeddings = embed_texts(texts, task_type="retrieval_document")
    logger.info(f"    ✅ Generated {len(embeddings)} embeddings (dim={len(embeddings[0])})")

    # 5. Index into AOSS
    logger.info(f"\n[5] Indexing into AOSS index '{AOSS_INDEX}'...")
    total = bulk_index(chunks, embeddings, client)
    logger.info(f"\n✅ Ingestion complete — {total} chunks indexed")

    # 6. Save config
    config = {
        "aoss_endpoint": AOSS_ENDPOINT,
        "aoss_index":    AOSS_INDEX,
        "vector_dim":    VECTOR_DIM,
        "embed_model":   GEMINI_EMBED,
        "s3_bucket":     S3_BUCKET,
        "s3_prefix":     S3_PREFIX,
        "total_chunks":  total,
        "created_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with open("rag_config.json", "w") as f:
        json.dump(config, f, indent=2)
    logger.info("    Config saved: rag_config.json")


# ── Query test ------------------------------------------------------------

def run_query(query: str, top_k: int = 4) -> None:
    import google.generativeai as genai
    genai.configure(api_key=GOOGLE_API_KEY)

    logger.info(f"\nQuery: {query}")
    result = genai.embed_content(model=GEMINI_EMBED, content=query, task_type="retrieval_query")
    vec = result["embedding"]

    client = _aoss_client()
    resp = client.search(
        index=AOSS_INDEX,
        body={
            "size": top_k,
            "query": {"knn": {"embedding": {"vector": vec, "k": top_k}}},
            "_source": ["text", "source", "chunk_id"],
        },
    )
    hits = resp["hits"]["hits"]
    print(f"\n=== Top {len(hits)} results for: '{query}' ===")
    for i, hit in enumerate(hits, 1):
        src   = hit["_source"]["source"]
        score = hit["_score"]
        text  = hit["_source"]["text"][:300].replace("\n", " ")
        print(f"\n[{i}] {src}  (score={score:.4f})")
        print(f"    {text}...")


# ── CLI ------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gemini + AOSS RAG setup")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--ingest",      action="store_true", help="Ingest documents from S3 into AOSS")
    group.add_argument("--ingest-local",action="store_true", help="Ingest from local RAGDocument/ directory")
    group.add_argument("--create-index",action="store_true", help="Only create the AOSS index (no ingestion)")
    group.add_argument("--query",       type=str,            help="Run a test retrieval query")
    args = parser.parse_args()

    if args.ingest:
        run_ingestion(use_local=False)
    elif args.ingest_local:
        run_ingestion(use_local=True)
    elif args.create_index:
        create_index()
    elif args.query:
        if not GOOGLE_API_KEY:
            print("ERROR: GOOGLE_API_KEY not set"); sys.exit(1)
        run_query(args.query)
