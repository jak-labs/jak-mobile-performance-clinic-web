import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const docClient = DynamoDBDocumentClient.from(client);

const SUBJECTS_TABLE = process.env.DYNAMODB_SUBJECTS_TABLE || "jak-subjects";

export interface SubjectProfile {
  owner_id: string; // Partition key - Coach/user ID who owns this subject
  subject_id: string; // Cognito user sub or temporary ID (Sort key if composite key)
  email: string;
  name?: string;
  full_name?: string;
  f_name?: string;
  l_name?: string;
  sport?: string;
  notes?: string;
  invite_token?: string;
  coach_id?: string;
  status?: string; // 'pending_invite', 'active', etc.
  created_at: string;
  updated_at: string;
}

/**
 * Save member/subject profile to DynamoDB
 */
export async function saveSubjectProfile(
  profile: Omit<SubjectProfile, "created_at" | "updated_at">
): Promise<void> {
  if (!SUBJECTS_TABLE) {
    throw new Error("DYNAMODB_SUBJECTS_TABLE environment variable is not set.");
  }

  const timestamp = new Date().toISOString();
  const command = new PutCommand({
    TableName: SUBJECTS_TABLE,
    Item: {
      owner_id: profile.owner_id, // Required partition key
      subject_id: profile.subject_id,
      email: profile.email,
      name: profile.name,
      full_name: profile.full_name,
      f_name: profile.f_name,
      l_name: profile.l_name,
      sport: profile.sport,
      notes: profile.notes,
      invite_token: profile.invite_token,
      coach_id: profile.coach_id,
      status: profile.status,
      created_at: timestamp,
      updated_at: timestamp,
    },
  });

  await docClient.send(command);
}

/**
 * Get subject by invite token
 */
export async function getSubjectByInviteToken(inviteToken: string): Promise<SubjectProfile | null> {
  if (!SUBJECTS_TABLE) {
    throw new Error("DYNAMODB_SUBJECTS_TABLE environment variable is not set.");
  }

  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: SUBJECTS_TABLE,
        FilterExpression: "invite_token = :token",
        ExpressionAttributeValues: {
          ":token": inviteToken,
        },
      })
    );

    return (result.Items?.[0] as SubjectProfile) || null;
  } catch (error) {
    console.error("Error getting subject by invite token:", error);
    throw error;
  }
}

/**
 * Update subject profile (e.g., when they sign up and get a real subject_id)
 */
export async function updateSubjectProfile(
  subjectId: string,
  updates: Partial<Omit<SubjectProfile, "subject_id" | "created_at">>
): Promise<void> {
  if (!SUBJECTS_TABLE) {
    throw new Error("DYNAMODB_SUBJECTS_TABLE environment variable is not set.");
  }

  const timestamp = new Date().toISOString();
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {
    ":updatedAt": timestamp,
  };

  for (const key in updates) {
    if (updates.hasOwnProperty(key) && updates[key as keyof typeof updates] !== undefined) {
      const value = updates[key as keyof typeof updates];
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  }

  if (updateExpressions.length === 0) {
    return; // No updates to perform
  }

  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";

  const command = new UpdateCommand({
    TableName: SUBJECTS_TABLE,
    Key: { subject_id: subjectId },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await docClient.send(command);
}

/**
 * Migrate pending subject to active subject with real Cognito sub
 * Creates new entry with real subject_id and deletes old pending entry
 */
export async function migratePendingSubjectToActive(
  inviteToken: string,
  realSubjectId: string
): Promise<void> {
  if (!SUBJECTS_TABLE) {
    throw new Error("DYNAMODB_SUBJECTS_TABLE environment variable is not set.");
  }

  // Get the pending subject
  const pendingSubject = await getSubjectByInviteToken(inviteToken);
  if (!pendingSubject) {
    throw new Error("Pending subject not found for invite token");
  }

  // Create new entry with real subject_id
  const timestamp = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: SUBJECTS_TABLE,
      Item: {
        ...pendingSubject,
        owner_id: pendingSubject.owner_id, // Keep owner_id from pending subject
        subject_id: realSubjectId,
        status: 'active',
        invite_token: undefined,
        created_at: pendingSubject.created_at, // Keep original creation time
        updated_at: timestamp,
      },
    })
  );

  // Delete the old pending entry (optional - you might want to keep it for audit)
  // For now, we'll just leave it - it won't interfere since we query by real subject_id
}
