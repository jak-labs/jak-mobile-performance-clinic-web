import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSubjectsByCoach, getUnassignedSubjects } from '@/lib/dynamodb-subjects';

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

    // Get subjects/clients assigned to this coach (including pending invites)
    const subjects = await getSubjectsByCoach(session.user.id);

    // Include all subjects (active and pending invites)
    // Pending invites will be shown with "pending" status in the UI

    // Get unassigned subjects (only for coaches)
    const allUnassignedSubjects = await getUnassignedSubjects();
    
    // Filter out unassigned subjects that are already assigned to this coach
    // This prevents duplicates from showing in both "My Clients" and "Un-Assigned Clients"
    const assignedSubjectIds = new Set(subjects.map(s => s.subject_id));
    const unassignedSubjects = allUnassignedSubjects.filter(
      (subject) => !assignedSubjectIds.has(subject.subject_id)
    );

    // Log for debugging - remove in production
    console.log(`Fetched ${subjects.length} assigned (including pending) and ${unassignedSubjects.length} unassigned subjects for coach ${session.user.id}`);

    return NextResponse.json(
      { 
        subjects: subjects, // Include all subjects including pending invites
        unassignedSubjects: unassignedSubjects 
      },
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

