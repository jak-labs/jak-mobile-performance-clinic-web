import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

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

const AI_SUMMARY_TABLE = "jak-coach-session-ai-summary";

export interface AISummary {
  subject_id: string; // Partition key - Subject/Participant ID
  session_id: string; // Sort key - Session ID (composite with summary_id for uniqueness)
  summary_id: string; // Unique summary ID (timestamp-based UUID) - stored as attribute
  participant_id: string; // Participant/Subject ID (same as subject_id, kept for compatibility)
  participant_name: string; // Participant/Subject name
  summary: string; // LLM-generated summary
  key_findings: string[]; // Array of key findings
  recommendations: string[]; // Array of recommendations
  overall_assessment: string; // Overall performance assessment
  metrics_summary: {
    average_balance_score?: number;
    average_symmetry_score?: number;
    average_postural_efficiency?: number;
    risk_level?: string;
  };
  insights_count: number; // Number of insights that were summarized
  created_at: string; // ISO 8601 timestamp
}

/**
 * Save AI summary to DynamoDB
 */
export async function saveAISummary(
  summary: Omit<AISummary, "created_at" | "subject_id">
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Use participant_id as subject_id (partition key)
  // For sort key, combine session_id with summary_id to ensure uniqueness
  // Format: session_id#summary_id
  const sortKey = `${summary.session_id}#${summary.summary_id}`;
  
  const item = {
    subject_id: summary.participant_id, // Partition key - Subject/Participant ID
    session_id: sortKey, // Sort key - Composite of session_id and summary_id
    summary_id: summary.summary_id, // Stored as attribute for reference
    participant_id: summary.participant_id,
    participant_name: summary.participant_name,
    summary: summary.summary,
    key_findings: summary.key_findings,
    recommendations: summary.recommendations,
    overall_assessment: summary.overall_assessment,
    metrics_summary: summary.metrics_summary,
    insights_count: summary.insights_count,
    created_at: timestamp,
  };

  console.log('[DynamoDB] Attempting to save AI summary:', {
    tableName: AI_SUMMARY_TABLE,
    session_id: item.session_id,
    summary_id: item.summary_id,
    participant_id: item.participant_id,
  });

  try {
    const command = new PutCommand({
      TableName: AI_SUMMARY_TABLE,
      Item: item,
    });

    await docClient.send(command);
    console.log('[DynamoDB] Successfully saved AI summary to DynamoDB');
  } catch (error: any) {
    console.error('[DynamoDB] ERROR saving AI summary to DynamoDB:', error);
    console.error('[DynamoDB] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      tableName: AI_SUMMARY_TABLE,
    });
    throw error;
  }
}

/**
 * Get AI summary for a subject/participant
 */
export async function getAISummaryBySubject(
  subjectId: string
): Promise<AISummary[]> {
  const command = new QueryCommand({
    TableName: AI_SUMMARY_TABLE,
    KeyConditionExpression: "subject_id = :subjectId",
    ExpressionAttributeValues: {
      ":subjectId": subjectId,
    },
    ScanIndexForward: false, // Sort by session_id descending (newest first)
  });

  const result = await docClient.send(command);
  return (result.Items || []) as AISummary[];
}

/**
 * Get AI summary for a session (requires subjectId to query)
 */
export async function getAISummaryBySession(
  subjectId: string,
  sessionId: string
): Promise<AISummary[]> {
  const command = new QueryCommand({
    TableName: AI_SUMMARY_TABLE,
    KeyConditionExpression: "subject_id = :subjectId AND begins_with(session_id, :sessionIdPrefix)",
    ExpressionAttributeValues: {
      ":subjectId": subjectId,
      ":sessionIdPrefix": `${sessionId}#`,
    },
    ScanIndexForward: false, // Sort by session_id descending (newest first)
  });

  const result = await docClient.send(command);
  return (result.Items || []) as AISummary[];
}

/**
 * Get all AI summaries for a session (scans table for all summaries with session_id prefix)
 */
export async function getAllAISummariesForSession(
  sessionId: string
): Promise<AISummary[]> {
  const sessionIdPrefix = `${sessionId}#`;
  
  const command = new ScanCommand({
    TableName: AI_SUMMARY_TABLE,
    FilterExpression: "begins_with(session_id, :sessionIdPrefix)",
    ExpressionAttributeValues: {
      ":sessionIdPrefix": sessionIdPrefix,
    },
  });

  const result = await docClient.send(command);
  const items = (result.Items || []) as AISummary[];
  
  // Sort by created_at descending (newest first)
  items.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return timeB - timeA;
  });
  
  return items;
}

/**
 * Get AI summary for a participant in a session
 */
export async function getAISummaryByParticipant(
  participantId: string,
  sessionId: string
): Promise<AISummary | null> {
  // Since participant_id is the same as subject_id (partition key), we can query directly
  const summaries = await getAISummaryBySession(participantId, sessionId);
  return summaries.length > 0 ? summaries[0] : null;
}

