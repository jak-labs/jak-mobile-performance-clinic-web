import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSession } from '@/lib/dynamodb-schedules';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();

    const { title, date, time, duration, sessionType, subjectIds, notes } = body;

    // Validate required fields
    if (!title || !date || !time || !duration || !sessionType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate subject selection
    if (!subjectIds || subjectIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one client must be selected' },
        { status: 400 }
      );
    }

    // Validate session type matches selection
    if (sessionType === 'single' && subjectIds.length !== 1) {
      return NextResponse.json(
        { error: '1:1 sessions must have exactly one client' },
        { status: 400 }
      );
    }

    if (sessionType === 'group' && subjectIds.length < 2) {
      return NextResponse.json(
        { error: 'Group sessions must have at least two clients' },
        { status: 400 }
      );
    }

    // Parse date and time to create ISO 8601 datetime string
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const sessionDateTime = new Date(year, month - 1, day, hours, minutes).toISOString();

    // Generate unique session ID
    const sessionId = randomUUID();

    // Prepare session data
    // sessionType is already converted to "single" or "group" from frontend
    const sessionData: any = {
      user_id: userId,
      session_date_time: sessionDateTime,
      session_id: sessionId,
      session_type: sessionType, // Already "single" or "group"
      title,
      duration: parseInt(duration, 10),
      notes: notes || undefined,
      status: 'scheduled',
    };

    // Add subject_id for single sessions, subject_ids for group sessions
    if (sessionType === 'single') {
      sessionData.subject_id = subjectIds[0];
    } else {
      sessionData.subject_ids = subjectIds;
    }

    // Create session in DynamoDB
    await createSession(sessionData);

    return NextResponse.json(
      {
        message: 'Session created successfully',
        session_id: sessionId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}

