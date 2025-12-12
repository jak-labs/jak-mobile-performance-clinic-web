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

const AI_METRICS_TABLE = "jak-coach-session-ai-metrics";

export interface AIMetric {
  subject_id: string; // Partition key - Subject/Participant ID
  timestamp: string; // Sort key - ISO 8601 timestamp
  session_id: string; // Session ID (for GSI querying)
  participant_id: string; // Participant/Subject ID (same as subject_id, kept for compatibility)
  participant_name: string; // Participant/Subject name
  balance_score: number; // 0-100
  symmetry_score: number; // 0-100
  postural_efficiency?: number; // 0-100
  risk_level?: string; // "Low", "Medium", "High"
  posture_metrics?: {
    spine_lean?: string;
    neck_flexion?: string;
    shoulder_alignment?: string;
    pelvic_sway?: string;
    additional_metrics?: string[];
  };
  movement_quality?: string; // Description of movement quality
  movement_patterns?: string[]; // Array of movement patterns observed
  movement_consistency?: number; // 0-100, how consistent movement is across frames
  dynamic_stability?: number; // 0-100, stability throughout movement
  created_at: string; // ISO 8601 timestamp
}

/**
 * Save AI metric to DynamoDB
 */
export async function saveAIMetric(
  metric: Omit<AIMetric, "created_at" | "subject_id">
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  const item: any = {
    subject_id: metric.participant_id, // Partition key - use participant_id as subject_id
    timestamp: metric.timestamp, // Sort key
    session_id: metric.session_id, // For GSI querying by session
    participant_id: metric.participant_id, // Same as subject_id, kept for compatibility
    participant_name: metric.participant_name,
    balance_score: metric.balance_score,
    symmetry_score: metric.symmetry_score,
    postural_efficiency: metric.postural_efficiency,
    risk_level: metric.risk_level,
    posture_metrics: metric.posture_metrics,
    movement_quality: metric.movement_quality,
    movement_patterns: metric.movement_patterns,
    movement_consistency: metric.movement_consistency,
    dynamic_stability: metric.dynamic_stability,
    created_at: timestamp,
  };

  console.log('[DynamoDB] Attempting to save AI metric:', {
    tableName: AI_METRICS_TABLE,
    subject_id: item.subject_id, // Partition key - use this exact value for querying
    timestamp: item.timestamp, // Sort key - use range query (begins_with or between) for better results
    session_id: item.session_id,
    participant_id: item.participant_id,
    // IMPORTANT: To query this metric in DynamoDB console:
    // 1. Use subject_id (partition key) with EXACT match: '011b9530-4011-70f1-93c1-46d482f5f882'
    // 2. Use timestamp (sort key) with RANGE query (begins_with '2025-12-12') or BETWEEN query
    //    Do NOT use exact match on timestamp - use a range/prefix query instead
  });

  try {
    const command = new PutCommand({
      TableName: AI_METRICS_TABLE,
      Item: item,
    });

    await docClient.send(command);
    console.log('[DynamoDB] Successfully saved AI metric to DynamoDB');
  } catch (error: any) {
    console.error('[DynamoDB] ERROR saving AI metric to DynamoDB:', error);
    console.error('[DynamoDB] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      tableName: AI_METRICS_TABLE,
    });
    throw error;
  }
}

/**
 * Get all metrics for a session
 * Note: This requires a GSI on session_id. If GSI doesn't exist, use getAllAIMetricsForSession instead.
 */
export async function getAIMetricsBySession(sessionId: string): Promise<AIMetric[]> {
  try {
    // Try to use GSI on session_id if it exists
    const command = new QueryCommand({
      TableName: AI_METRICS_TABLE,
      IndexName: 'session_id-index', // GSI name (adjust if different)
      KeyConditionExpression: "session_id = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
      ScanIndexForward: false, // Sort by timestamp descending (newest first)
    });

    const response = await docClient.send(command);
    return (response.Items || []) as AIMetric[];
  } catch (error: any) {
    // If GSI doesn't exist or query fails, fall back to scan
    console.warn('[DynamoDB] GSI query failed, falling back to scan:', error.message);
    return getAllAIMetricsForSession(sessionId);
  }
}

/**
 * Get all metrics for a session and participant
 */
export async function getAIMetricsBySessionAndParticipant(
  sessionId: string,
  participantId: string
): Promise<AIMetric[]> {
  try {
    // Query by subject_id (partition key) and filter by session_id
    const command = new QueryCommand({
      TableName: AI_METRICS_TABLE,
      KeyConditionExpression: "subject_id = :subjectId",
      FilterExpression: "session_id = :sessionId",
      ExpressionAttributeValues: {
        ":subjectId": participantId,
        ":sessionId": sessionId,
      },
      ScanIndexForward: false, // Sort by timestamp descending (newest first)
    });

    const response = await docClient.send(command);
    return (response.Items || []) as AIMetric[];
  } catch (error: any) {
    console.error('[DynamoDB] Error getting AI metrics by session and participant:', error);
    throw error;
  }
}

/**
 * Get all metrics for a session (using scan as fallback if query doesn't work)
 */
export async function getAllAIMetricsForSession(sessionId: string): Promise<AIMetric[]> {
  try {
    const command = new ScanCommand({
      TableName: AI_METRICS_TABLE,
      FilterExpression: "session_id = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
    });

    const response = await docClient.send(command);
    const metrics = (response.Items || []) as AIMetric[];
    
    // Sort by timestamp descending (newest first) since Scan doesn't guarantee order
    metrics.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    console.log(`[DynamoDB] Retrieved ${metrics.length} metrics for session ${sessionId}. Latest timestamp: ${metrics[0]?.timestamp || 'none'}`);
    
    return metrics;
  } catch (error: any) {
    console.error('[DynamoDB] Error getting all AI metrics for session:', error);
    throw error;
  }
}
