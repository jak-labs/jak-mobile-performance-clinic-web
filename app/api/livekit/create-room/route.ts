import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { RoomServiceClient, CreateRoomOptions } from 'livekit-server-sdk';

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

    const { roomName } = await req.json();

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      );
    }

    // Create room service client
    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

    // Create room options
    const opts: CreateRoomOptions = {
      name: roomName,
      emptyTimeout: 10 * 60, // 10 minutes
      maxParticipants: 20,
    };

    // Create the room
    const room = await roomService.createRoom(opts);

    return NextResponse.json(
      {
        roomName: room.name,
        roomSid: room.sid,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error creating LiveKit room:', error);
    
    // If room already exists, that's okay - return the room name
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      return NextResponse.json(
        {
          roomName,
          message: 'Room already exists',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create room' },
      { status: 500 }
    );
  }
}

