import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined, // Will use IAM role if running on AWS
});

const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "jak-users";

export interface UserProfile {
  userId: string; // Cognito user sub
  email: string;
  fullName?: string;
  practiceName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Save user profile to DynamoDB
 */
export async function saveUserProfile(profile: Omit<UserProfile, "createdAt" | "updatedAt">): Promise<void> {
  const now = new Date().toISOString();
  
  const item: UserProfile = {
    ...profile,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: item,
      })
    );
  } catch (error) {
    console.error("Error saving user profile to DynamoDB:", error);
    throw error;
  }
}

/**
 * Get user profile from DynamoDB
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      })
    );

    return result.Item as UserProfile | null;
  } catch (error) {
    console.error("Error getting user profile from DynamoDB:", error);
    throw error;
  }
}

/**
 * Update user profile in DynamoDB
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, "userId" | "createdAt">>
): Promise<void> {
  const now = new Date().toISOString();
  
  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (updates.email !== undefined) {
    updateExpressions.push("#email = :email");
    expressionAttributeNames["#email"] = "email";
    expressionAttributeValues[":email"] = updates.email;
  }

  if (updates.fullName !== undefined) {
    updateExpressions.push("#fullName = :fullName");
    expressionAttributeNames["#fullName"] = "fullName";
    expressionAttributeValues[":fullName"] = updates.fullName;
  }

  if (updates.practiceName !== undefined) {
    updateExpressions.push("#practiceName = :practiceName");
    expressionAttributeNames["#practiceName"] = "practiceName";
    expressionAttributeValues[":practiceName"] = updates.practiceName;
  }

  // Always update updatedAt
  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = now;

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  } catch (error) {
    console.error("Error updating user profile in DynamoDB:", error);
    throw error;
  }
}

