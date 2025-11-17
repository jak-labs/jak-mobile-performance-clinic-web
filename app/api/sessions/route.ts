import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCoachSessions } from '@/lib/dynamodb-schedules';
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize Cognito client for group checking
// Use JAK_ prefixed vars for Netlify (AWS_* are reserved), fallback to AWS_* for local dev
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || 'us-east-2',
  credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

// Initialize DynamoDB client for member session queries
const dynamoClient = new DynamoDBClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || 'us-east-2',
  credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);
const SCHEDULES_TABLE = 'jak-coach-sessions-schedule';

/**
 * Get sessions for a member (where they are in subject_id or subject_ids)
 */
async function getMemberSessions(
  memberId: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  try {
    // Scan the table and filter for sessions where member is in subject_id or subject_ids
    // Note: DynamoDB FilterExpression doesn't support checking if a value is in an array,
    // so we'll scan with date filter (if provided) and filter in code for member participation
    const scanParams: any = {
      TableName: SCHEDULES_TABLE,
    };

    // Add date range filter if provided (this can be done in DynamoDB)
    if (startDate || endDate) {
      const dateFilter: string[] = [];
      if (startDate) {
        dateFilter.push('session_date_time >= :startDate');
        scanParams.FilterExpression = 'session_date_time >= :startDate';
        scanParams.ExpressionAttributeValues = { ':startDate': startDate };
      }
      if (endDate) {
        if (scanParams.FilterExpression) {
          scanParams.FilterExpression += ' AND session_date_time <= :endDate';
        } else {
          scanParams.FilterExpression = 'session_date_time <= :endDate';
        }
        if (!scanParams.ExpressionAttributeValues) {
          scanParams.ExpressionAttributeValues = {};
        }
        scanParams.ExpressionAttributeValues[':endDate'] = endDate;
      }
    }

    // Scan all sessions (with date filter if provided)
    const result = await docClient.send(new ScanCommand(scanParams));
    const allSessions = (result.Items || []) as any[];

    // Filter in code for sessions where member is in subject_id (1:1) or subject_ids (group)
    const memberSessions = allSessions.filter((session) => {
      // Check if member is in 1:1 session
      if (session.subject_id === memberId) {
        return true;
      }
      // Check if member is in group session
      if (session.subject_ids && Array.isArray(session.subject_ids)) {
        return session.subject_ids.includes(memberId);
      }
      return false;
    });

    return memberSessions;
  } catch (error) {
    console.error('Error getting member sessions from DynamoDB:', error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Get optional date range from query params
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Check if user is a coach or member
    let isCoach = false;
    let isMember = false;
    try {
      const userPoolId = process.env.COGNITO_ISSUER?.split('/').pop();
      if (userPoolId) {
        const username = session.user.id || session.user.email;
        if (username) {
          const groupsResponse = await cognitoClient.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: userPoolId,
              Username: username,
            })
          );
          const groups = groupsResponse.Groups || [];
          isMember = groups.some((g) => g.GroupName === 'Member');
          isCoach = groups.some((g) => g.GroupName === 'Coach');
        }
      }
    } catch (error) {
      console.error('Error checking user groups:', error);
    }

    // Get sessions based on user role
    let sessions: any[];
    if (isCoach) {
      // Coaches see sessions they created
      sessions = await getCoachSessions(userId, startDate || undefined, endDate || undefined);
    } else if (isMember) {
      // Members see sessions where they are in subject_id or subject_ids
      sessions = await getMemberSessions(userId, startDate || undefined, endDate || undefined);
    } else {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid user role' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { sessions },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting sessions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sessions' },
      { status: 500 }
    );
  }
}

