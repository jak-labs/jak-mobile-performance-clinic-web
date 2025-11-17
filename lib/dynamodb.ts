import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
// Use JAK_ prefixed vars for Netlify (AWS_* are reserved), fallback to AWS_* for local dev
const client = new DynamoDBClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || "us-east-2", // Hardcoded default: us-east-2
  credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined, // Will use IAM role if running on AWS
});

const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = "jak-users";

export interface UserProfile {
  userId: string; // Cognito user sub
  email: string;
  fullName?: string; // Keep for backward compatibility
  f_name?: string; // First name
  l_name?: string; // Last name
  practiceName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Save user profile to DynamoDB
 */
export async function saveUserProfile(profile: Omit<UserProfile, "createdAt" | "updatedAt">): Promise<void> {
  const now = new Date().toISOString();
  
  // Parse fullName into f_name and l_name if fullName is provided but f_name/l_name are not
  let f_name = profile.f_name;
  let l_name = profile.l_name;
  
  if (profile.fullName && !f_name && !l_name) {
    const nameParts = profile.fullName.split(' ');
    f_name = nameParts[0] || undefined;
    l_name = nameParts.slice(1).join(' ') || undefined;
  }
  
  // DynamoDB table uses snake_case for all fields
  const item = {
    user_id: profile.userId,
    email: profile.email,
    full_name: profile.fullName, // Map fullName to full_name
    f_name: f_name,
    l_name: l_name,
    practice_name: profile.practiceName, // Map practiceName to practice_name
    created_at: now, // Use snake_case
    updated_at: now, // Use snake_case
  };

  try {
    console.log('Attempting to save user profile to DynamoDB:', {
      tableName: USERS_TABLE,
      userId: profile.userId,
      email: profile.email,
      hasCredentials: !!(process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID),
      region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || "us-east-2"
    });
    
    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: item,
      })
    );
    
    console.log('Successfully saved user profile to DynamoDB');
  } catch (error: any) {
    console.error("ERROR saving user profile to DynamoDB:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      tableName: USERS_TABLE,
      item: JSON.stringify(item, null, 2)
    });
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
        Key: { user_id: userId }, // DynamoDB uses user_id (underscore) as partition key
      })
    );

    if (!result.Item) {
      return null;
    }

    // Map DynamoDB item (snake_case) back to TypeScript interface (camelCase)
    const item = result.Item as any;
    return {
      userId: item.user_id || item.userId, // Support both formats
      email: item.email,
      fullName: item.full_name || item.fullName, // Map full_name to fullName
      f_name: item.f_name,
      l_name: item.l_name,
      practiceName: item.practice_name || item.practiceName, // Map practice_name to practiceName
      createdAt: item.created_at || item.createdAt, // Map created_at to createdAt
      updatedAt: item.updated_at || item.updatedAt, // Map updated_at to updatedAt
    } as UserProfile;
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
    // Update full_name (snake_case) in DynamoDB
    updateExpressions.push("#full_name = :full_name");
    expressionAttributeNames["#full_name"] = "full_name";
    expressionAttributeValues[":full_name"] = updates.fullName;
    
    // Also parse and update f_name and l_name
    const nameParts = updates.fullName.split(' ');
    updateExpressions.push("#f_name = :f_name");
    expressionAttributeNames["#f_name"] = "f_name";
    expressionAttributeValues[":f_name"] = nameParts[0] || null;
    
    updateExpressions.push("#l_name = :l_name");
    expressionAttributeNames["#l_name"] = "l_name";
    expressionAttributeValues[":l_name"] = nameParts.slice(1).join(' ') || null;
  }
  
  if (updates.f_name !== undefined) {
    updateExpressions.push("#f_name = :f_name");
    expressionAttributeNames["#f_name"] = "f_name";
    expressionAttributeValues[":f_name"] = updates.f_name;
  }
  
  if (updates.l_name !== undefined) {
    updateExpressions.push("#l_name = :l_name");
    expressionAttributeNames["#l_name"] = "l_name";
    expressionAttributeValues[":l_name"] = updates.l_name;
  }
  
  if (updates.practiceName !== undefined) {
    // Update practice_name (snake_case) in DynamoDB
    updateExpressions.push("#practice_name = :practice_name");
    expressionAttributeNames["#practice_name"] = "practice_name";
    expressionAttributeValues[":practice_name"] = updates.practiceName;
  }

  // Always update updated_at (snake_case)
  updateExpressions.push("#updated_at = :updated_at");
  expressionAttributeNames["#updated_at"] = "updated_at";
  expressionAttributeValues[":updated_at"] = now;

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { user_id: userId }, // DynamoDB uses user_id (underscore) as partition key
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

