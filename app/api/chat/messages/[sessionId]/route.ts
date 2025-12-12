import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getChatMessagesForSession } from '@/lib/dynamodb-chat';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log(`[API Chat] Fetching messages for session: ${sessionId}`);
    const messages = await getChatMessagesForSession(sessionId);
    console.log(`[API Chat] Found ${messages.length} messages for session: ${sessionId}`);

    return NextResponse.json(
      { messages },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API Chat] Error fetching messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

