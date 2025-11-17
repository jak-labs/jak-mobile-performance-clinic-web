import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSubjectProfile, updateSubjectProfile } from '@/lib/dynamodb-subjects';
import { getUserProfile } from '@/lib/dynamodb';

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

    const { id: subjectId } = await params;

    // Query by subject_id only - owner_id is the coach's ID, not the member's ID
    const subject = await getSubjectProfile(subjectId);
    
    if (!subject) {
      return NextResponse.json(
        { error: 'Subject profile not found' },
        { status: 404 }
      );
    }

    // Authorization check:
    // - Members can only view their own profile (session.user.id === subjectId)
    // - Coaches can view profiles of subjects they own (session.user.id === subject.owner_id)
    const isViewingOwnProfile = session.user.id === subjectId;
    const isCoachViewingClient = session.user.id === subject.owner_id;
    
    if (!isViewingOwnProfile && !isCoachViewingClient) {
      return NextResponse.json(
        { error: 'Forbidden - You can only view your own profile or profiles of clients assigned to you' },
        { status: 403 }
      );
    }

    // Fetch coach information
    // Try coach_id first, then fallback to owner_id if it's different from subject_id
    let coach = null;
    const coachId = subject.coach_id || (subject.owner_id && subject.owner_id !== subjectId ? subject.owner_id : null);
    
    console.log('Subject profile:', JSON.stringify(subject, null, 2));
    console.log('Subject coach_id:', subject.coach_id);
    console.log('Subject owner_id:', subject.owner_id);
    console.log('Subject subject_id:', subjectId);
    console.log('Using coachId:', coachId);
    
    if (coachId) {
      try {
        console.log('Fetching coach profile for coachId:', coachId);
        const coachProfile = await getUserProfile(coachId);
        console.log('Coach profile found:', JSON.stringify(coachProfile, null, 2));
        
        if (coachProfile) {
          coach = {
            userId: coachProfile.userId,
            name: coachProfile.fullName || coachProfile.email,
            email: coachProfile.email,
          };
        } else {
          console.log('Coach profile not found in jak-users table for coachId:', coachId);
        }
      } catch (error) {
        console.error('Error fetching coach profile:', error);
        // Continue without coach info if fetch fails
      }
    } else {
      console.log('No coach_id or valid owner_id found in subject profile');
    }

    return NextResponse.json(
      { subject, coach },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting subject profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get subject profile' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const { id: subjectId } = await params;

    // Members can only update their own profile
    if (session.user.id !== subjectId) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own profile' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { f_name, l_name, name, full_name, sport } = body;

    // Get existing profile to preserve owner_id
    // Note: Don't pass session.user.id as ownerId - owner_id is the coach's ID, not the member's
    const existingProfile = await getSubjectProfile(subjectId);
    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Subject profile not found' },
        { status: 404 }
      );
    }

    // Prepare updates
    const updates: any = {};

    if (f_name !== undefined) updates.f_name = f_name;
    if (l_name !== undefined) updates.l_name = l_name;
    if (name !== undefined) updates.name = name;
    if (full_name !== undefined) updates.full_name = full_name;
    if (sport !== undefined) updates.sport = sport;

    // Update full_name if f_name or l_name changed
    if (f_name !== undefined || l_name !== undefined) {
      const firstName = f_name !== undefined ? f_name : existingProfile.f_name || '';
      const lastName = l_name !== undefined ? l_name : existingProfile.l_name || '';
      updates.full_name = `${firstName} ${lastName}`.trim();
      updates.name = updates.full_name;
    }

    await updateSubjectProfile(subjectId, updates, existingProfile.owner_id);

    // Fetch updated profile
    const updatedProfile = await getSubjectProfile(subjectId);

    return NextResponse.json(
      { 
        message: 'Profile updated successfully',
        subject: updatedProfile 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating subject profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update subject profile' },
      { status: 500 }
    );
  }
}

