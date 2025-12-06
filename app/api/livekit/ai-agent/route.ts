import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { AccessToken } from 'livekit-server-sdk';
import { Room, RoomServiceClient, VideoFrame, VideoSource, TrackSource } from 'livekit-server-sdk';
import { connect } from 'livekit-client';

export async function POST(req: NextRequest) {
  try {
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
    const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      );
    }

    // Create access token for AI agent
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `ai-agent-${Date.now()}`,
      name: 'AI Movement Analyst',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json(
      { token, agentIdentity: `ai-agent-${Date.now()}` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error creating AI agent token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create AI agent' },
      { status: 500 }
    );
  }
}



