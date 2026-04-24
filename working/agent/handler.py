"""
AWS Lambda entry point - wraps the FastAPI app with Mangum.
"""
from mangum import Mangum
from src.main import app

handler = Mangum(app, lifespan="off")
