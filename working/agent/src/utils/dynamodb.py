"""
Shared DynamoDB resource - reused across all modules.
"""
import boto3
from src.config.settings import AWS_REGION

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
