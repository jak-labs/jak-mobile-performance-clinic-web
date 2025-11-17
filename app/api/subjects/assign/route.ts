import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { assignSubjectToCoach } from '@/lib/dynamodb-subjects';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user (coach)
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { subjectId } = body;

    if (!subjectId) {
      return NextResponse.json(
        { error: 'subjectId is required' },
        { status: 400 }
      );
    }

    // Assign the subject to this coach
    await assignSubjectToCoach(subjectId, session.user.id);

    return NextResponse.json(
      { message: 'Client assigned successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error assigning subject:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign client' },
      { status: 500 }
    );
  }
}

