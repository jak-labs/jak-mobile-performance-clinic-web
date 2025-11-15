# DynamoDB Setup for User Profiles

## Table Structure

Create a DynamoDB table named `jak-users` (or set `DYNAMODB_USERS_TABLE` env var) with the following structure:

### Table Name
- **Table Name**: `jak-users` (or value of `DYNAMODB_USERS_TABLE` env var)

### Primary Key
- **Partition Key**: `userId` (String) - This is the Cognito user sub (unique user identifier)

### Attributes
- `userId` (String) - Cognito user sub, primary key
- `email` (String) - User's email address
- `fullName` (String, optional) - User's full name
- `practiceName` (String, optional) - User's practice name
- `createdAt` (String) - ISO timestamp when user was created
- `updatedAt` (String) - ISO timestamp when user was last updated

## AWS Console Setup

1. Go to AWS DynamoDB Console
2. Click "Create table"
3. Table name: `jak-users`
4. Partition key: `userId` (String)
5. Table settings: Use default settings or customize as needed
6. Click "Create table"

## Environment Variables

Add these to your `.env.local`:

```env
# DynamoDB Configuration
DYNAMODB_USERS_TABLE=jak-users
AWS_REGION=us-east-2

# AWS Credentials (if not using IAM role)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

**Note**: If running on AWS (EC2, Lambda, etc.), you can use IAM roles instead of access keys.

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
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/jak-users"
    }
  ]
}
```

## Usage

The user profile is automatically saved to DynamoDB when a user signs up. The `practiceName` and other profile data are stored there instead of in Cognito custom attributes.

