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

const CHAT_TABLE = "jak-coach-session-chat";

export interface ChatMessage {
  session_id: string; // Partition key - Session ID
  timestamp: string; // Sort key - ISO 8601 timestamp (for chronological ordering)
  message_id: string; // Unique message ID (UUID)
  participant_id: string; // Who sent the message (participant ID or "ai_agent")
  participant_name: string; // Display name (e.g., "Coach", "James Doe", "AI Agent")
  message: string; // Message content
  message_type: "user" | "ai_agent"; // Type of message
  metadata?: {
    // Optional metadata for AI agent messages
    metric_type?: "balance" | "symmetry" | "postural" | "general";
    participant_id?: string; // For AI messages about a specific participant
    values?: {
      balance_score?: number;
      symmetry_score?: number;
      postural_efficiency?: number;
    };
  };
  created_at: string; // ISO 8601 timestamp (same as timestamp, kept for consistency)
}

/**
 * Save a chat message to DynamoDB
 */
export async function saveChatMessage(
  message: Omit<ChatMessage, "created_at" | "timestamp" | "message_id">
): Promise<void> {
  const timestamp = new Date().toISOString();
  const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const item: ChatMessage = {
    session_id: message.session_id,
    timestamp: timestamp, // Sort key
    message_id: messageId,
    participant_id: message.participant_id,
    participant_name: message.participant_name,
    message: message.message,
    message_type: message.message_type,
    metadata: message.metadata,
    created_at: timestamp,
  };

  console.log('[DynamoDB Chat] 💾 Attempting to save chat message:', {
    tableName: CHAT_TABLE,
    session_id: item.session_id,
    message_id: item.message_id,
    participant_id: item.participant_id,
    message_type: item.message_type,
  });

  try {
    const command = new PutCommand({
      TableName: CHAT_TABLE,
      Item: item,
    });

    await docClient.send(command);
    console.log('[DynamoDB Chat] ✅ Successfully saved chat message to DynamoDB');
  } catch (error: any) {
    console.error('[DynamoDB Chat] ❌ ERROR saving chat message to DynamoDB:', error);
    if (error.name === 'ResourceNotFoundException') {
      console.error(`[DynamoDB Chat] Table ${CHAT_TABLE} does not exist. Please create it in AWS Console.`);
    }
    throw error;
  }
}

/**
 * Get all chat messages for a session (ordered by timestamp ascending)
 */
export async function getChatMessagesForSession(sessionId: string): Promise<ChatMessage[]> {
  try {
    const command = new QueryCommand({
      TableName: CHAT_TABLE,
      KeyConditionExpression: "session_id = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
      ScanIndexForward: true, // Sort by timestamp ascending (oldest first)
    });

    const response = await docClient.send(command);
    const messages = (response.Items || []) as ChatMessage[];

    // Sort by timestamp to ensure chronological order
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`[DynamoDB Chat] Retrieved ${messages.length} messages for session ${sessionId}`);
    
    return messages;
  } catch (error: any) {
    console.error('[DynamoDB Chat] Error getting chat messages for session:', error);
    throw error;
  }
}

/**
 * Get recent chat messages for a session (last N messages)
 */
export async function getRecentChatMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
  try {
    const command = new QueryCommand({
      TableName: CHAT_TABLE,
      KeyConditionExpression: "session_id = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
      ScanIndexForward: false, // Sort by timestamp descending (newest first)
      Limit: limit,
    });

    const response = await docClient.send(command);
    const messages = (response.Items || []) as ChatMessage[];

    // Reverse to get chronological order (oldest first)
    messages.reverse();

    console.log(`[DynamoDB Chat] Retrieved ${messages.length} recent messages for session ${sessionId}`);
    
    return messages;
  } catch (error: any) {
    console.error('[DynamoDB Chat] Error getting recent chat messages:', error);
    throw error;
  }
}


