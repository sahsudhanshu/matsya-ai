#!/bin/bash

# Migration script to create the ai-bharat-groups DynamoDB table
# This script creates the Groups_Table for multi-image group analysis

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================="
echo "DynamoDB Groups_Table Migration Script"
echo "=========================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not configured${NC}"
    echo "Please run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS CLI is installed and configured${NC}"
echo ""

# Configuration
TABLE_NAME="ai-bharat-groups"
REGION="${AWS_REGION:-ap-south-1}"

echo "Configuration:"
echo "  Table Name: $TABLE_NAME"
echo "  Region: $REGION"
echo ""

# Check if table already exists
echo "Checking if table already exists..."
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" &> /dev/null; then
    echo -e "${YELLOW}⚠ Table '$TABLE_NAME' already exists${NC}"
    echo -e "${GREEN}✓ Table is ready to use${NC}"
    exit 0
fi

echo -e "${YELLOW}→ Table does not exist, creating...${NC}"
echo ""

# Create the table
echo "Creating DynamoDB table: $TABLE_NAME"
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=groupId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=groupId,KeyType=HASH \
  --global-secondary-indexes \
    "[{
      \"IndexName\": \"userId-createdAt-index\",
      \"KeySchema\": [
        {\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},
        {\"AttributeName\": \"createdAt\", \"KeyType\": \"RANGE\"}
      ],
      \"Projection\": {\"ProjectionType\": \"ALL\"}
    }]" \
  --region "$REGION" \
  > /dev/null

echo -e "${GREEN}✓ Table creation initiated${NC}"
echo ""

# Wait for table to become active
echo "Waiting for table to become active..."
aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"

echo -e "${GREEN}✓ Table is now active${NC}"
echo ""

# Enable Point-in-Time Recovery
echo "Enabling point-in-time recovery..."
aws dynamodb update-continuous-backups \
  --table-name "$TABLE_NAME" \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region "$REGION" \
  > /dev/null

echo -e "${GREEN}✓ Point-in-time recovery enabled${NC}"
echo ""

# Enable server-side encryption (SSE)
echo "Enabling server-side encryption..."
aws dynamodb update-table \
  --table-name "$TABLE_NAME" \
  --sse-specification Enabled=true \
  --region "$REGION" \
  > /dev/null

echo -e "${GREEN}✓ Server-side encryption enabled${NC}"
echo ""

# Verify table configuration
echo "Verifying table configuration..."
TABLE_INFO=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION")

# Extract and display key information
TABLE_STATUS=$(echo "$TABLE_INFO" | grep -o '"TableStatus": "[^"]*"' | cut -d'"' -f4)
ITEM_COUNT=$(echo "$TABLE_INFO" | grep -o '"ItemCount": [0-9]*' | cut -d' ' -f2)

echo ""
echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Table Details:"
echo "  Name: $TABLE_NAME"
echo "  Status: $TABLE_STATUS"
echo "  Region: $REGION"
echo "  Billing Mode: PAY_PER_REQUEST"
echo "  Item Count: $ITEM_COUNT"
echo ""
echo "Features Enabled:"
echo "  ✓ Global Secondary Index: userId-createdAt-index"
echo "  ✓ Point-in-Time Recovery"
echo "  ✓ Server-Side Encryption"
echo ""
echo -e "${GREEN}✓ Groups_Table is ready for use!${NC}"
