import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userPoolId = process.env.COGNITO_ISSUER?.split('/').pop();
    if (!userPoolId) {
      return NextResponse.json(
        { error: 'Invalid COGNITO_ISSUER format' },
        { status: 500 }
      );
    }

    // Get user's groups
    const groupsResponse = await cognitoClient.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: session.user.email,
      })
    );

    const groups = (groupsResponse.Groups || []).map((g) => g.GroupName);
    const isMember = groups.includes('Member');
    const isCoach = groups.includes('Coach');

    return NextResponse.json(
      {
        groups,
        isMember,
        isCoach,
        userType: isMember ? 'member' : isCoach ? 'coach' : 'unknown',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting user groups:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get user groups' },
      { status: 500 }
    );
  }
}

