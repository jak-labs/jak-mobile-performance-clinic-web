# DynamoDB Schedules Setup

## Table Structure

### Table: `jak-coach-sessions-schedule`

**Primary Key:**
- **Partition Key**: `user_id` (String) - Coach/user ID from Cognito
- **Sort Key**: `session_date_time` (String) - ISO 8601 format (e.g., `2024-11-15T14:30:00.000Z`)

**Attributes:**
- `session_id` (String) - Unique session identifier (UUID)
- `subject_id` (String, optional) - For single/1:1 sessions
- `subject_ids` (Array of Strings, optional) - For group sessions
- `session_type` (String) - Either "single" or "group"
- `title` (String) - Session title
- `duration` (Number) - Duration in minutes
- `notes` (String, optional) - Session notes
- `status` (String, optional) - "scheduled", "completed", "cancelled", "rescheduled" (default: "scheduled")
- `created_at` (String) - ISO 8601 timestamp
- `updated_at` (String) - ISO 8601 timestamp

## AWS Console Setup

1. Go to AWS DynamoDB Console
2. Click "Create table"
3. Table name: `jak-coach-sessions-schedule`
4. Partition key: `user_id` (String)
5. Sort key: `session_date_time` (String)
6. Table settings: Use default settings or customize as needed
7. Click "Create table"

## Table: `jak-subjects`

This table should already exist and contain your subjects/clients. The API will scan this table to get the list of available clients.

**Expected Structure:**
- Should have `subject_id` (or `id`) as identifier
- Should have `name` (or `full_name`) for client name
- Optional: `sport` (or `sport_type`) for sport information

## Environment Variables

Add these to your `.env.local`:

```env
# DynamoDB Configuration
DYNAMODB_SCHEDULES_TABLE=jak-coach-sessions-schedule
DYNAMODB_SUBJECTS_TABLE=jak-subjects
AWS_REGION=us-east-2

# AWS Credentials (if not using IAM role)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
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
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/jak-coach-sessions-schedule",
        "arn:aws:dynamodb:*:*:table/jak-coach-sessions-schedule/index/*",
        "arn:aws:dynamodb:*:*:table/jak-subjects"
      ]
    }
  ]
}
```

## Usage

Sessions are automatically created in DynamoDB when a coach schedules a session through the UI. The system will:

1. Get the authenticated coach's user ID from the session
2. Create a session record with the coach's ID as the partition key
3. Use the session date/time as the sort key for chronological ordering
4. Store subject IDs for the selected clients

## Query Patterns

- **Get all sessions for a coach**: Query by `user_id`
- **Get sessions for a date range**: Query by `user_id` with `session_date_time` between start and end dates
- **Get upcoming sessions**: Query by `user_id` with `session_date_time >= now()`

