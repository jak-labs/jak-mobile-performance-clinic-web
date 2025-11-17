import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getUserProfile } from '@/lib/dynamodb';
import { getSubjectProfile } from '@/lib/dynamodb-subjects';
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

// Initialize Cognito client for group checking
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || 'us-east-2',
  credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: participantId } = await params;
    const { searchParams } = new URL(req.url);
    const sessionOwnerId = searchParams.get('sessionOwnerId'); // Optional: session owner ID to determine coach

    // Determine if this participant is the coach (session owner)
    const isSessionOwner = sessionOwnerId && participantId === sessionOwnerId;
    
    // Try jak-users table first (coaches) - query by user_id
    const coachProfile = await getUserProfile(participantId);
    if (coachProfile) {
      // Get full_name directly from database
      const fullName = coachProfile.fullName || '';
      const firstName = coachProfile.f_name || '';
      const lastName = coachProfile.l_name || '';
      
      return NextResponse.json({
        userId: participantId,
        email: coachProfile.email,
        firstName: firstName,
        lastName: lastName,
        fullName: fullName, // Use full_name from jak-users table
        role: isSessionOwner ? 'coach' : 'participant',
        label: isSessionOwner ? 'Coach' : 'Participant',
      });
    }
    
    // Try jak-subjects table (members) - query by subject_id
    const subjectProfile = await getSubjectProfile(participantId);
    if (subjectProfile) {
      // Get full_name directly from database
      const fullName = subjectProfile.full_name || '';
      const firstName = subjectProfile.f_name || '';
      const lastName = subjectProfile.l_name || '';
      
      return NextResponse.json({
        userId: participantId,
        email: subjectProfile.email,
        firstName: firstName,
        lastName: lastName,
        fullName: fullName, // Use full_name from jak-subjects table
        role: 'member',
        label: 'Participant',
      });
    }

    // If we can't find the participant, return minimal info
    return NextResponse.json({
      userId: participantId,
      email: '',
      firstName: '',
      lastName: '',
      fullName: '',
      role: 'unknown',
      label: 'Participant',
    });
  } catch (error: any) {
    console.error('Error getting participant info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get participant info' },
      { status: 500 }
    );
  }
}

