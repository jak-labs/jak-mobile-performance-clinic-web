import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCoachSessions } from '@/lib/dynamodb-schedules';

export async function GET(req: NextRequest) {
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
    
    // Get optional date range from query params
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get sessions from DynamoDB
    const sessions = await getCoachSessions(userId, startDate || undefined, endDate || undefined);

    return NextResponse.json(
      { sessions },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting sessions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sessions' },
      { status: 500 }
    );
  }
}

