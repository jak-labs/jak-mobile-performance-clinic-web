import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAllSubjects } from '@/lib/dynamodb-schedules';

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

    // Get all subjects/clients
    const subjects = await getAllSubjects();

    // Log for debugging - remove in production
    console.log("Fetched subjects:", JSON.stringify(subjects, null, 2));

    return NextResponse.json(
      { subjects },
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

