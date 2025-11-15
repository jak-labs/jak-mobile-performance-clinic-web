import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

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

const SCHEDULES_TABLE = process.env.DYNAMODB_SCHEDULES_TABLE || "jak-coach-sessions-schedule";
const SUBJECTS_TABLE = process.env.DYNAMODB_SUBJECTS_TABLE || "jak-subjects";

export interface ScheduleSession {
  user_id: string; // Partition Key (coach ID)
  session_date_time: string; // Sort Key (ISO 8601 format)
  session_id: string; // Unique session identifier
  subject_id?: string; // For 1:1 sessions
  subject_ids?: string[]; // For group sessions
  session_type: "single" | "group";
  title: string;
  duration: number; // Duration in minutes
  notes?: string;
  status?: "scheduled" | "completed" | "cancelled" | "rescheduled";
  livekit_room_name?: string; // LiveKit room name for video sessions
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

export interface Subject {
  subject_id: string;
  name: string;
  sport?: string;
  email?: string;
  [key: string]: any; // Allow other attributes
}

/**
 * Create a new session in DynamoDB
 */
export async function createSession(session: Omit<ScheduleSession, "created_at" | "updated_at">): Promise<void> {
  const now = new Date().toISOString();
  
  const item: ScheduleSession = {
    ...session,
    status: session.status || "scheduled",
    created_at: now,
    updated_at: now,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: SCHEDULES_TABLE,
        Item: item,
      })
    );
  } catch (error) {
    console.error("Error creating session in DynamoDB:", error);
    throw error;
  }
}

/**
 * Get all sessions for a coach within a date range
 */
export async function getCoachSessions(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<ScheduleSession[]> {
  try {
    let params: any = {
      TableName: SCHEDULES_TABLE,
      KeyConditionExpression: "user_id = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };

    // Add date range filter if provided
    if (startDate || endDate) {
      params.KeyConditionExpression += " AND session_date_time BETWEEN :startDate AND :endDate";
      if (startDate) {
        params.ExpressionAttributeValues[":startDate"] = startDate;
      }
      if (endDate) {
        params.ExpressionAttributeValues[":endDate"] = endDate;
      }
    }

    const result = await docClient.send(new QueryCommand(params));
    return (result.Items as ScheduleSession[]) || [];
  } catch (error) {
    console.error("Error getting coach sessions from DynamoDB:", error);
    throw error;
  }
}

/**
 * Get a single session by user_id and session_date_time
 */
export async function getSession(userId: string, sessionDateTime: string): Promise<ScheduleSession | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: SCHEDULES_TABLE,
        Key: {
          user_id: userId,
          session_date_time: sessionDateTime,
        },
      })
    );

    return result.Item as ScheduleSession | null;
  } catch (error) {
    console.error("Error getting session from DynamoDB:", error);
    throw error;
  }
}

/**
 * Get a session by session_id (scans all sessions - consider adding GSI for better performance)
 */
export async function getSessionById(sessionId: string, userId?: string): Promise<ScheduleSession | null> {
  try {
    // If userId is provided, query by user_id and filter by session_id
    if (userId) {
      const sessions = await getCoachSessions(userId);
      return sessions.find((s) => s.session_id === sessionId) || null;
    }

    // Otherwise, scan the table (less efficient but works)
    const result = await docClient.send(
      new ScanCommand({
        TableName: SCHEDULES_TABLE,
        FilterExpression: "session_id = :sessionId",
        ExpressionAttributeValues: {
          ":sessionId": sessionId,
        },
      })
    );

    return (result.Items?.[0] as ScheduleSession) || null;
  } catch (error) {
    console.error("Error getting session by ID from DynamoDB:", error);
    throw error;
  }
}

/**
 * Get all subjects/clients from DynamoDB
 * Note: This uses Scan which may be slow for large tables
 * Consider using Query with a GSI if you need better performance
 */
export async function getAllSubjects(): Promise<Subject[]> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: SUBJECTS_TABLE,
      })
    );

    return (result.Items as Subject[]) || [];
  } catch (error) {
    console.error("Error getting subjects from DynamoDB:", error);
    throw error;
  }
}

