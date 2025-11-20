import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getUserProfile } from '@/lib/dynamodb';
import { getSubjectProfile } from '@/lib/dynamodb-subjects';
import { getSessionById } from '@/lib/dynamodb-schedules';
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
    const { id: participantId } = await params;
    const { searchParams } = new URL(req.url);
    const sessionOwnerId = searchParams.get('sessionOwnerId');
    const sessionId = searchParams.get('sessionId');
    
    console.log(`[API] GET /api/participants/${participantId} - sessionOwnerId: ${sessionOwnerId}, sessionId: ${sessionId}`);
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log(`[API] Unauthorized - no session user ID`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    let ownerId = sessionOwnerId; // Use the extracted sessionOwnerId

    // If sessionOwnerId is not provided but sessionId is, try to get it from the session schedule table
    if (!ownerId && sessionId) {
      try {
        const scheduleSession = await getSessionById(sessionId);
        if (scheduleSession) {
          ownerId = scheduleSession.user_id; // user_id is the coach/owner
          console.log(`[API] Retrieved sessionOwnerId (${ownerId}) from session ${sessionId}`);
        }
      } catch (error) {
        console.error('[API] Error fetching session to get owner_id:', error);
      }
    }

    // Step 1: Determine if participant is a Coach
    // A participant is a coach if their identity matches the sessionOwnerId (user_id from jak-coach-sessions-schedule)
    const isCoach = ownerId && participantId === ownerId;
    
    console.log(`[API] Fetching participant info for ${participantId}, sessionOwnerId: ${ownerId}, isCoach: ${isCoach}`);
    
    if (isCoach) {
      // Step 2: If Coach → query jak-users table by user_id to get f_name and l_name
      console.log(`[API] Participant is Coach - querying jak-users table for user_id: ${participantId}`);
      const coachProfile = await getUserProfile(participantId);
      console.log(`[API] getUserProfile result for ${participantId}:`, coachProfile ? {
        userId: coachProfile.userId,
        email: coachProfile.email,
        fullName: coachProfile.fullName,
        f_name: coachProfile.f_name,
        l_name: coachProfile.l_name
      } : 'null');
      
      if (coachProfile) {
        const firstName = coachProfile.f_name || '';
        const lastName = coachProfile.l_name || '';
        let fullName = coachProfile.fullName || '';
        
        // Construct fullName from f_name and l_name
        if (!fullName && firstName && lastName) {
          fullName = `${firstName} ${lastName}`.trim();
        } else if (!fullName && firstName) {
          fullName = firstName.trim();
        } else if (!fullName && lastName) {
          fullName = lastName.trim();
        }
        
        console.log(`[API] Found coach profile for ${participantId}:`, { firstName, lastName, fullName });
        
        return NextResponse.json({
          userId: participantId,
          email: coachProfile.email,
          firstName: firstName,
          lastName: lastName,
          fullName: fullName,
          role: 'coach',
          label: 'Coach',
        });
      } else {
        console.log(`[API] Coach profile not found in jak-users for ${participantId}`);
      }
    } else {
      // Step 3: If NOT Coach → query jak-subjects table by subject_id (and owner_id if available) to get f_name and l_name
      console.log(`[API] Participant is NOT Coach - querying jak-subjects table for subject_id: ${participantId} with ownerId: ${ownerId}`);
      const subjectProfile = await getSubjectProfile(participantId, ownerId || undefined);
      console.log(`[API] getSubjectProfile result for ${participantId}:`, subjectProfile ? {
        subject_id: subjectProfile.subject_id,
        owner_id: subjectProfile.owner_id,
        email: subjectProfile.email,
        full_name: subjectProfile.full_name,
        f_name: subjectProfile.f_name,
        l_name: subjectProfile.l_name
      } : 'null');
      
      if (subjectProfile) {
        const firstName = subjectProfile.f_name || '';
        const lastName = subjectProfile.l_name || '';
        let fullName = subjectProfile.full_name || '';
        
        // Construct fullName from f_name and l_name
        if (!fullName && firstName && lastName) {
          fullName = `${firstName} ${lastName}`.trim();
        } else if (!fullName && firstName) {
          fullName = firstName.trim();
        } else if (!fullName && lastName) {
          fullName = lastName.trim();
        }
        
        console.log(`[API] Found subject profile for ${participantId}:`, { firstName, lastName, fullName, owner_id: subjectProfile.owner_id });
        
        return NextResponse.json({
          userId: participantId,
          email: subjectProfile.email,
          firstName: firstName,
          lastName: lastName,
          fullName: fullName,
          role: 'member',
          label: 'Participant',
        });
      } else {
        console.log(`[API] Subject profile not found in jak-subjects for ${participantId}`);
      }
    }
    
    console.log(`[API] No profile found for participant ${participantId} in jak-users or jak-subjects tables`);

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

