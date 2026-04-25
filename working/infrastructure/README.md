# Infrastructure Setup

This directory contains infrastructure configuration files and migration scripts for the AI-Powered Fisherman's Assistant.

## Files

- `dynamodb-tables.json` - DynamoDB table schema definitions
- `iam-policies.json` - IAM policy definitions for Lambda functions
- `migrate-groups-table.sh` - Migration script for creating the Groups_Table
- `.env.example` - Example environment variables

## DynamoDB Tables

### ai-bharat-groups

The Groups_Table stores image group records for multi-image analysis.

**Schema:**
- **Partition Key:** `groupId` (String) - UUID
- **Global Secondary Index:** `userId-createdAt-index`
  - Partition Key: `userId` (String)
  - Sort Key: `createdAt` (String) - ISO 8601 timestamp

**Features:**
- PAY_PER_REQUEST billing mode
- Point-in-time recovery enabled
- Server-side encryption enabled

**Attributes:**
- `groupId` - Unique identifier for the image group
- `userId` - User who created the group
- `createdAt` - ISO 8601 timestamp of creation
- `updatedAt` - ISO 8601 timestamp of last update
- `status` - Group processing status (pending, processing, completed, partial, failed)
- `imageCount` - Number of images in the group
- `s3Keys` - Array of S3 keys for all images
- `analysisResult` - Combined ML analysis results (JSON)
- `latitude`, `longitude` - Optional location data
- `errors` - Array of error records for failed images

## Migration Scripts

### migrate-groups-table.sh

Creates the `ai-bharat-groups` DynamoDB table with all required configurations.

**Prerequisites:**
- AWS CLI installed and configured
- Appropriate IAM permissions to create DynamoDB tables

**Usage:**

```bash
# Run from the infrastructure directory
./migrate-groups-table.sh

# Or specify a custom region
AWS_REGION=us-east-1 ./migrate-groups-table.sh
```

**Features:**
- Verifies AWS CLI is installed and configured
- Checks if table already exists (idempotent)
- Creates table with proper schema
- Enables point-in-time recovery
- Enables server-side encryption
- Waits for table to become active
- Displays verification information

**Output:**
- Success: Table created and ready to use
- Already exists: Skips creation and confirms table is ready
- Error: Displays error message and exits with non-zero code

## Manual Table Creation

If you prefer to create the table manually using AWS CLI:

```bash
aws dynamodb create-table \
  --table-name ai-bharat-groups \
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
  --region ap-south-1

# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name ai-bharat-groups \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region ap-south-1

# Enable server-side encryption
aws dynamodb update-table \
  --table-name ai-bharat-groups \
  --sse-specification Enabled=true \
  --region ap-south-1
```

## Verification

To verify the table was created successfully:

```bash
aws dynamodb describe-table --table-name ai-bharat-groups --region ap-south-1
```

Expected output should show:
- TableStatus: ACTIVE
- BillingModeSummary: PAY_PER_REQUEST
- GlobalSecondaryIndexes: userId-createdAt-index
- SSEDescription: Enabled
- ContinuousBackupsDescription: PointInTimeRecoveryEnabled

## Troubleshooting

### AWS CLI not configured
```
Error: AWS CLI is not configured
```
**Solution:** Run `aws configure` and provide your AWS credentials.

### Insufficient permissions
```
Error: User is not authorized to perform: dynamodb:CreateTable
```
**Solution:** Ensure your IAM user/role has the necessary DynamoDB permissions.

### Table already exists
```
⚠ Table 'ai-bharat-groups' already exists
✓ Table is ready to use
```
**Solution:** This is not an error. The script is idempotent and will skip creation if the table exists.

### Region mismatch
If you're using a different region than `ap-south-1`, set the `AWS_REGION` environment variable:
```bash
export AWS_REGION=us-east-1
./migrate-groups-table.sh
```
