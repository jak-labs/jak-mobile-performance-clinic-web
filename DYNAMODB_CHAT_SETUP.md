# DynamoDB Chat Table Setup

## Table Structure

### Table: `jak-coach-session-chat`

**Primary Key:**
- **Partition Key**: `session_id` (String) - Session ID to get all messages for a session
- **Sort Key**: `timestamp` (String) - ISO 8601 format (e.g., `2024-12-11T22:01:35.811Z`) for chronological ordering

**Attributes:**
- `message_id` (String) - Unique message identifier (UUID/timestamp-based)
- `participant_id` (String) - Who sent the message (participant ID or "ai_agent")
- `participant_name` (String) - Display name (e.g., "Coach", "James Doe", "AI Agent")
- `message` (String) - Message content
- `message_type` (String) - Either "user" or "ai_agent"
- `metadata` (Map, optional) - Optional metadata for AI agent messages:
  - `metric_type` (String, optional) - "balance", "symmetry", "postural", or "general"
  - `participant_id` (String, optional) - For AI messages about a specific participant
  - `values` (Map, optional) - Metric values:
    - `balance_score` (Number, optional)
    - `symmetry_score` (Number, optional)
    - `postural_efficiency` (Number, optional)
- `created_at` (String) - ISO 8601 timestamp (same as timestamp)

## AWS Console Setup

1. Go to AWS DynamoDB Console
2. Click "Create table"
3. Table name: `jak-coach-session-chat`
4. Partition key: `session_id` (String)
5. Sort key: `timestamp` (String)
6. Table settings: Use default settings or customize as needed
7. Click "Create table"

## Query Patterns

- **Get all messages for a session**: Query by `session_id` (sorted by `timestamp` ascending)
- **Get recent messages**: Query by `session_id` with `ScanIndexForward: false` and `Limit: N`

## Example Messages

### User Message
```json
{
  "session_id": "131dbba5-7d75-48c5-8b80-a26566d8ba00",
  "timestamp": "2024-12-11T22:01:35.811Z",
  "message_id": "1733956895811-abc123",
  "participant_id": "b12b0510-9041-7082-78b1-f6c0ff6f33bc",
  "participant_name": "Gustavo Fring",
  "message": "How are you feeling today?",
  "message_type": "user",
  "created_at": "2024-12-11T22:01:35.811Z"
}
```

### AI Agent Message (Metrics)
```json
{
  "session_id": "131dbba5-7d75-48c5-8b80-a26566d8ba00",
  "timestamp": "2024-12-11T22:01:40.500Z",
  "message_id": "1733956900500-xyz789",
  "participant_id": "ai_agent",
  "participant_name": "AI Agent",
  "message": "📊 James Doe: Balance 89, Symmetry 91, Postural 90",
  "message_type": "ai_agent",
  "metadata": {
    "metric_type": "general",
    "participant_id": "011b9530-4011-70f1-93c1-46d482f5f882",
    "values": {
      "balance_score": 89,
      "symmetry_score": 91,
      "postural_efficiency": 90
    }
  },
  "created_at": "2024-12-11T22:01:40.500Z"
}
```

## IAM Permissions

Your AWS credentials need the following DynamoDB permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/jak-coach-session-chat"
    }
  ]
}
```


