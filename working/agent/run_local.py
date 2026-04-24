"""
Local development entry point.

Run with:
    cd agent
    pip install -r requirements.txt
    uvicorn src.main:app --reload --port 8001
"""
import uvicorn
import os

# Load .env file for local development
try:
    from dotenv import load_dotenv
    load_dotenv()
    print(f"✅ Loaded .env - GOOGLE_API_KEY={'set' if os.getenv('GOOGLE_API_KEY') else 'MISSING'}")
except ImportError:
    print("⚠️  python-dotenv not installed, skipping .env loading")

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(os.environ["PORT"]),
        reload=True,
    )
