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

    // Check if participant is a coach or member
    let isCoach = false;
    let isMember = false;
    
    try {
      const userPoolId = process.env.COGNITO_ISSUER?.split('/').pop();
      if (userPoolId) {
        // Get participant's email from their identity (we'll need to get it from their profile)
        // For now, try to get profile and determine role from that
        
        // Determine if this participant is the coach (session owner)
        const isSessionOwner = sessionOwnerId && participantId === sessionOwnerId;
        
        // Try to get as coach first
        const coachProfile = await getUserProfile(participantId);
        if (coachProfile) {
          // If this participant is the session owner, they're the coach for this session
          // Otherwise, they might be a coach but not the coach for this specific session
          const isCoachForThisSession = isSessionOwner;
          return NextResponse.json({
            userId: participantId,
            email: coachProfile.email,
            firstName: coachProfile.fullName?.split(' ')[0] || '',
            lastName: coachProfile.fullName?.split(' ').slice(1).join(' ') || '',
            fullName: coachProfile.fullName || coachProfile.email,
            role: isCoachForThisSession ? 'coach' : 'participant',
            label: isCoachForThisSession ? 'Coach' : 'Participant',
          });
        }
        
        // Try to get as member/subject
        const subjectProfile = await getSubjectProfile(participantId);
        if (subjectProfile) {
          // Members are never the coach (session owner)
          return NextResponse.json({
            userId: participantId,
            email: subjectProfile.email,
            firstName: subjectProfile.f_name || '',
            lastName: subjectProfile.l_name || '',
            fullName: subjectProfile.full_name || subjectProfile.name || subjectProfile.email,
            role: 'member',
            label: 'Member',
          });
        }
      }
    } catch (error) {
      console.error('Error checking participant role:', error);
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

