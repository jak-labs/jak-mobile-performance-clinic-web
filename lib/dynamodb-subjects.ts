import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
// Use JAK_ prefixed vars for Netlify (AWS_* are reserved), fallback to AWS_* for local dev
const client = new DynamoDBClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || "us-east-2",
  credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const docClient = DynamoDBDocumentClient.from(client);

const SUBJECTS_TABLE = "jak-subjects";

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
 * Get subject profile by subject_id
 * Note: This uses Scan which may be slow for large tables
 * Consider using Query with owner_id if you have it for better performance
 * 
 * If there are duplicates (due to the old bug), this function will prefer:
 * - Records where owner_id !== subject_id (assigned to a coach) over
 * - Records where owner_id === subject_id (self-owned/unassigned)
 */
export async function getSubjectProfile(subjectId: string, ownerId?: string): Promise<SubjectProfile | null> {

  try {
    // If owner_id is provided, we can use Query (more efficient)
    if (ownerId) {
      const result = await docClient.send(
        new ScanCommand({
          TableName: SUBJECTS_TABLE,
          FilterExpression: "owner_id = :ownerId AND subject_id = :subjectId",
          ExpressionAttributeValues: {
            ":ownerId": ownerId,
            ":subjectId": subjectId,
          },
        })
      );
      return (result.Items?.[0] as SubjectProfile) || null;
    }

    // Otherwise, scan by subject_id only
    // If there are multiple records (duplicates), prefer the one assigned to a coach
    const result = await docClient.send(
      new ScanCommand({
        TableName: SUBJECTS_TABLE,
        FilterExpression: "subject_id = :subjectId",
        ExpressionAttributeValues: {
          ":subjectId": subjectId,
        },
      })
    );

    const items = (result.Items as SubjectProfile[]) || [];
    
    if (items.length === 0) {
      return null;
    }
    
    // If there are multiple records, prefer the one assigned to a coach (owner_id !== subject_id)
    // This handles the duplicate records issue
    if (items.length > 1) {
      const assignedRecord = items.find(item => item.owner_id !== item.subject_id);
      if (assignedRecord) {
        console.log(`Found duplicate records for subject_id ${subjectId}, using assigned record (owner_id: ${assignedRecord.owner_id})`);
        return assignedRecord;
      }
    }
    
    // Return the first (or only) record
    return items[0];
  } catch (error) {
    console.error("Error getting subject profile:", error);
    throw error;
  }
}

/**
 * Update subject profile (e.g., when they sign up and get a real subject_id)
 */
export async function updateSubjectProfile(
  subjectId: string,
  updates: Partial<Omit<SubjectProfile, "subject_id" | "created_at">>,
  ownerId?: string
): Promise<void> {

  // Get existing profile to get owner_id if not provided
  let existingProfile: SubjectProfile | null = null;
  if (!ownerId && !updates.owner_id) {
    existingProfile = await getSubjectProfile(subjectId);
    if (!existingProfile) {
      throw new Error("Subject profile not found");
    }
    ownerId = existingProfile.owner_id;
  }

  const finalOwnerId = ownerId || updates.owner_id || existingProfile?.owner_id;
  if (!finalOwnerId) {
    throw new Error("owner_id is required for update");
  }

  const timestamp = new Date().toISOString();
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {
    ":updatedAt": timestamp,
  };

  // Don't update owner_id if it's in updates (it's part of the key)
  const updatesToProcess = { ...updates };
  delete updatesToProcess.owner_id;

  for (const key in updatesToProcess) {
    if (updatesToProcess.hasOwnProperty(key) && updatesToProcess[key as keyof typeof updatesToProcess] !== undefined) {
      const value = updatesToProcess[key as keyof typeof updatesToProcess];
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
    Key: { 
      owner_id: finalOwnerId,
      subject_id: subjectId 
    },
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

  // Get the pending subject
  const pendingSubject = await getSubjectByInviteToken(inviteToken);
  if (!pendingSubject) {
    throw new Error("Pending subject not found for invite token");
  }

  // Create new entry with real subject_id
  const timestamp = new Date().toISOString();
  
  // Preserve all important fields from pending subject, especially coach_id
  const migratedSubject = {
    ...pendingSubject,
    owner_id: pendingSubject.owner_id, // Keep owner_id from pending subject
    subject_id: realSubjectId, // Update to real Cognito sub
    status: 'active',
    invite_token: undefined, // Clear invite token
    coach_id: pendingSubject.coach_id, // Explicitly preserve coach_id
    created_at: pendingSubject.created_at, // Keep original creation time
    updated_at: timestamp,
  };
  
  console.log('Migrating pending subject to active:', JSON.stringify(migratedSubject, null, 2));
  
  await docClient.send(
    new PutCommand({
      TableName: SUBJECTS_TABLE,
      Item: migratedSubject,
    })
  );

  // Delete the old pending entry with the invite token as subject_id
  await docClient.send(
    new DeleteCommand({
      TableName: SUBJECTS_TABLE,
      Key: {
        owner_id: pendingSubject.owner_id,
        subject_id: inviteToken, // The old subject_id was the invite token
      },
    })
  );
}

/**
 * Get all subjects assigned to a specific coach (by owner_id)
 * Uses Query for efficient access since owner_id is the partition key
 * Table structure: owner_id (partition key) + subject_id (sort key)
 */
export async function getSubjectsByCoach(ownerId: string): Promise<SubjectProfile[]> {

  try {
    // Query by owner_id (partition key) to get all subjects for this coach
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: SUBJECTS_TABLE,
        KeyConditionExpression: "owner_id = :ownerId",
        ExpressionAttributeValues: {
          ":ownerId": ownerId,
        },
      })
    );
    
    return (queryResult.Items as SubjectProfile[]) || [];
  } catch (error) {
    console.error("Error getting subjects by coach:", error);
    throw error;
  }
}

/**
 * Get all un-assigned subjects (subjects where owner_id equals subject_id - self-owned)
 * These are clients who signed up themselves without a coach invite
 */
export async function getUnassignedSubjects(): Promise<SubjectProfile[]> {
  try {
    // Scan the table to find subjects where owner_id equals subject_id (self-owned/unassigned)
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: SUBJECTS_TABLE,
        FilterExpression: "owner_id = subject_id",
      })
    );
    
    // Filter out pending invites
    const unassigned = (scanResult.Items as SubjectProfile[]) || [];
    return unassigned.filter(
      (subject) => subject.status !== 'pending_invite'
    );
  } catch (error) {
    console.error("Error getting unassigned subjects:", error);
    throw error;
  }
}

/**
 * Assign a subject to a coach by updating the owner_id
 * Since owner_id is the partition key, we need to:
 * 1. Get the existing subject (scan by subject_id)
 * 2. Create a new item with the new owner_id
 * 3. Delete the old item (if owner_id changed)
 */
export async function assignSubjectToCoach(
  subjectId: string,
  coachId: string
): Promise<void> {
  try {
    // First, get the current subject profile - scan for subject_id
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: SUBJECTS_TABLE,
        FilterExpression: "subject_id = :subjectId",
        ExpressionAttributeValues: {
          ":subjectId": subjectId,
        },
      })
    );
    
    const existingSubject = scanResult.Items?.[0] as SubjectProfile | undefined;
    if (!existingSubject) {
      throw new Error("Subject not found");
    }
    
    const oldOwnerId = existingSubject.owner_id;
    
    // Create new item with new owner_id
    const timestamp = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: SUBJECTS_TABLE,
        Item: {
          ...existingSubject,
          owner_id: coachId, // New owner_id (partition key)
          coach_id: coachId, // Also set coach_id
          updated_at: timestamp,
        },
      })
    );
    
    // Delete the old item if owner_id changed
    if (oldOwnerId !== coachId) {
      await docClient.send(
        new DeleteCommand({
          TableName: SUBJECTS_TABLE,
          Key: {
            owner_id: oldOwnerId,
            subject_id: subjectId,
          },
        })
      );
    }
  } catch (error) {
    console.error("Error assigning subject to coach:", error);
    throw error;
  }
}
