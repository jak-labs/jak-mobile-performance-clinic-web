import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById, updateSessionStatusById } from '@/lib/dynamodb-schedules';

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get the session to verify the user is the coach
    const dbSession = await getSessionById(sessionId);

    if (!dbSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify that the current user is the coach (session owner)
    if (dbSession.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the coach can end the session' },
        { status: 403 }
      );
    }

    // Update session status to "completed" (ended)
    await updateSessionStatusById(sessionId, 'completed', session.user.id);

    console.log(`[API] Session ${sessionId} ended by coach ${session.user.id}`);

    return NextResponse.json(
      { success: true, message: 'Session ended successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Error ending session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to end session' },
      { status: 500 }
    );
  }
}

