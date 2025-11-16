import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById } from '@/lib/dynamodb-schedules';
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

// Initialize Cognito client for group checking
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessionId = params.id;
    const userId = session.user.id;

    // Check if user is a coach or member
    let isCoach = false;
    let isMember = false;
    try {
      const userPoolId = process.env.COGNITO_ISSUER?.split('/').pop();
      if (userPoolId) {
        const groupsResponse = await cognitoClient.send(
          new AdminListGroupsForUserCommand({
            UserPoolId: userPoolId,
            Username: session.user.email,
          })
        );
        const groups = groupsResponse.Groups || [];
        isMember = groups.some((g) => g.GroupName === 'Member');
        isCoach = groups.some((g) => g.GroupName === 'Coach');
      }
    } catch (error) {
      console.error('Error checking user groups:', error);
    }

    // Get session from DynamoDB
    // For coaches, pass their user_id to filter by coach
    // For members, don't pass user_id (will scan and check if member is in session)
    const dbSession = await getSessionById(sessionId, isCoach ? userId : undefined);

    if (!dbSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Authorization check:
    // - Coaches can access if they created the session (user_id matches)
    // - Members can access if they're in subject_id or subject_ids
    if (isCoach) {
      if (dbSession.user_id !== userId) {
        return NextResponse.json(
          { error: 'Forbidden - You can only access sessions you created' },
          { status: 403 }
        );
      }
    } else if (isMember) {
      const isInSession = 
        dbSession.subject_id === userId || 
        (dbSession.subject_ids && Array.isArray(dbSession.subject_ids) && dbSession.subject_ids.includes(userId));
      
      if (!isInSession) {
        return NextResponse.json(
          { error: 'Forbidden - You are not part of this session' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid user role' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { session: dbSession },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get session' },
      { status: 500 }
    );
  }
}

