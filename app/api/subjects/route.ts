import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSubjectsByCoach } from '@/lib/dynamodb-subjects';

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user (coach)
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get only subjects/clients assigned to this coach
    // owner_id is the coach's ID for subjects assigned via invite
    const subjects = await getSubjectsByCoach(session.user.id);

    // Filter out pending invites (only show active subjects)
    const activeSubjects = subjects.filter(
      (subject) => subject.status !== 'pending_invite' && !subject.subject_id.startsWith('pending-')
    );

    // Log for debugging - remove in production
    console.log(`Fetched ${activeSubjects.length} subjects for coach ${session.user.id}`);

    return NextResponse.json(
      { subjects: activeSubjects },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting subjects:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get subjects' },
      { status: 500 }
    );
  }
}

