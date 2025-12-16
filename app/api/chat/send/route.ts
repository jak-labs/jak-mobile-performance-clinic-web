import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { saveChatMessage } from '@/lib/dynamodb-chat';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sessionId, participantId, participantName, message, messageType = 'user', metadata } = body;

    if (!sessionId || !participantId || !participantName || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, participantId, participantName, message' },
        { status: 400 }
      );
    }

    if (messageType !== 'user' && messageType !== 'ai_agent') {
      return NextResponse.json(
        { error: 'messageType must be "user" or "ai_agent"' },
        { status: 400 }
      );
    }

    console.log(`[API Chat] Saving message for session: ${sessionId}, from: ${participantName} (${participantId})`);
    
    await saveChatMessage({
      session_id: sessionId,
      participant_id: participantId,
      participant_name: participantName,
      message: message,
      message_type: messageType,
      metadata: metadata,
    });

    console.log(`[API Chat] ✅ Successfully saved message`);

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API Chat] Error saving message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save message' },
      { status: 500 }
    );
  }
}


