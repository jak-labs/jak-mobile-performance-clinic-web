import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

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

const AI_INSIGHTS_TABLE = "jak-coach-session-ai-insights";

export interface AIInsight {
  subject_id: string; // Partition key - Subject/Participant ID
  session_id: string; // Sort key - Session ID (composite with insight_id for uniqueness)
  insight_id: string; // Unique insight ID (timestamp-based UUID) - stored as attribute, not key
  participant_id: string; // Participant/Subject ID (same as subject_id, kept for compatibility)
  participant_name: string; // Participant/Subject name
  exercise_name?: string; // Exercise name if applicable
  posture_metrics?: {
    spine_lean?: string;
    neck_flexion?: string;
    shoulder_alignment?: string;
    pelvic_sway?: string;
    additional_metrics?: string[];
  };
  performance_interpretation?: string;
  performance_impact?: string[];
  balance_score: number;
  symmetry_score: number;
  postural_efficiency?: number;
  risk_level?: string;
  risk_description?: string;
  targeted_recommendations?: string[];
  timestamp: string; // ISO 8601 timestamp
  created_at: string; // ISO 8601 timestamp
}

/**
 * Save AI insight to DynamoDB
 */
export async function saveAIInsight(
  insight: Omit<AIInsight, "created_at" | "subject_id">
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Use participant_id as subject_id (partition key)
  // For sort key, combine session_id with insight_id to ensure uniqueness
  // Format: session_id#insight_id
  const sortKey = `${insight.session_id}#${insight.insight_id}`;
  
  const item = {
    subject_id: insight.participant_id, // Partition key - Subject/Participant ID
    session_id: sortKey, // Sort key - Composite of session_id and insight_id
    insight_id: insight.insight_id, // Stored as attribute for reference
    participant_id: insight.participant_id,
    participant_name: insight.participant_name,
    exercise_name: insight.exercise_name,
    posture_metrics: insight.posture_metrics,
    performance_interpretation: insight.performance_interpretation,
    performance_impact: insight.performance_impact,
    balance_score: insight.balance_score,
    symmetry_score: insight.symmetry_score,
    postural_efficiency: insight.postural_efficiency,
    risk_level: insight.risk_level,
    risk_description: insight.risk_description,
    targeted_recommendations: insight.targeted_recommendations,
    timestamp: insight.timestamp,
    created_at: timestamp,
  };

  console.log('[DynamoDB] Attempting to save AI insight:', {
    tableName: AI_INSIGHTS_TABLE,
    subject_id: item.subject_id, // Partition key
    session_id: item.session_id, // Sort key (composite: session_id#insight_id)
    insight_id: item.insight_id,
    participant_id: item.participant_id,
    hasCredentials: !!(process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID),
    region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || "us-east-2",
  });

  try {
    const command = new PutCommand({
      TableName: AI_INSIGHTS_TABLE,
      Item: item,
    });

    await docClient.send(command);
    console.log('[DynamoDB] Successfully saved AI insight to DynamoDB');
  } catch (error: any) {
    console.error('[DynamoDB] ERROR saving AI insight to DynamoDB:', error);
    console.error('[DynamoDB] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      tableName: AI_INSIGHTS_TABLE,
      item: JSON.stringify(item, null, 2),
    });
    throw error;
  }
}

/**
 * Get AI insights for a subject/participant
 */
export async function getAIInsightsBySubject(
  subjectId: string
): Promise<AIInsight[]> {
  const command = new QueryCommand({
    TableName: AI_INSIGHTS_TABLE,
    KeyConditionExpression: "subject_id = :subjectId",
    ExpressionAttributeValues: {
      ":subjectId": subjectId,
    },
    ScanIndexForward: false, // Sort by session_id descending (newest first)
  });

  const result = await docClient.send(command);
  return (result.Items || []) as AIInsight[];
}

/**
 * Get AI insights for a session (requires subjectId to query)
 */
export async function getAIInsightsBySession(
  subjectId: string,
  sessionId: string
): Promise<AIInsight[]> {
  const command = new QueryCommand({
    TableName: AI_INSIGHTS_TABLE,
    KeyConditionExpression: "subject_id = :subjectId AND begins_with(session_id, :sessionIdPrefix)",
    ExpressionAttributeValues: {
      ":subjectId": subjectId,
      ":sessionIdPrefix": `${sessionId}#`,
    },
    ScanIndexForward: false, // Sort by session_id descending (newest first)
  });

  const result = await docClient.send(command);
  return (result.Items || []) as AIInsight[];
}

/**
 * Get AI insights for a participant in a session
 */
export async function getAIInsightsByParticipant(
  participantId: string,
  sessionId: string
): Promise<AIInsight[]> {
  // Since participant_id is the same as subject_id (partition key), we can query directly
  return getAIInsightsBySession(participantId, sessionId);
}

/**
 * Get all AI insights for a session (scans table for all insights with session_id prefix)
 * This is useful when you don't know all participant IDs
 */
export async function getAllAIInsightsForSession(
  sessionId: string
): Promise<AIInsight[]> {
  const sessionIdPrefix = `${sessionId}#`;
  
  const command = new ScanCommand({
    TableName: AI_INSIGHTS_TABLE,
    FilterExpression: "begins_with(session_id, :sessionIdPrefix)",
    ExpressionAttributeValues: {
      ":sessionIdPrefix": sessionIdPrefix,
    },
  });

  const result = await docClient.send(command);
  const items = (result.Items || []) as AIInsight[];
  
  // Sort by timestamp descending (newest first)
  items.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
  
  return items;
}

