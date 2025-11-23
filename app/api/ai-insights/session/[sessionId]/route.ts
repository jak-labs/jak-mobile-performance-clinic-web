import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById } from '@/lib/dynamodb-schedules';
import { getAIInsightsBySession, getAIInsightsBySubject } from '@/lib/dynamodb-ai-insights';

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

    // Get session details to find all participants
    const dbSession = await getSessionById(sessionId);
    
    if (!dbSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get all participant IDs from the session
    const participantIds: string[] = [];
    
    if (dbSession.subject_id) {
      participantIds.push(dbSession.subject_id);
    }
    
    if (dbSession.subject_ids && Array.isArray(dbSession.subject_ids)) {
      participantIds.push(...dbSession.subject_ids);
    }

    // Remove duplicates
    const uniqueParticipantIds = [...new Set(participantIds)];

    if (uniqueParticipantIds.length === 0) {
      return NextResponse.json(
        { insights: [] },
        { status: 200 }
      );
    }

    // Fetch insights for all participants in this session
    const allInsightsPromises = uniqueParticipantIds.map(async (participantId) => {
      try {
        return await getAIInsightsBySession(participantId, sessionId);
      } catch (error) {
        console.error(`[API] Error fetching insights for participant ${participantId}:`, error);
        return [];
      }
    });

    const allInsightsArrays = await Promise.all(allInsightsPromises);
    const allInsights = allInsightsArrays.flat();

    // Sort by timestamp descending (newest first)
    allInsights.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    // Limit to most recent 50 insights
    const recentInsights = allInsights.slice(0, 50);

    return NextResponse.json(
      { insights: recentInsights },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Error fetching AI insights for session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch AI insights' },
      { status: 500 }
    );
  }
}

