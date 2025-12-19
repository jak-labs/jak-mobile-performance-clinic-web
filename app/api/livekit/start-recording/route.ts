import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { EgressClient } from "livekit-server-sdk"
import { EncodedFileType } from "@livekit/protocol"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { roomName, exerciseId } = await req.json()

    if (!roomName) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 })
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.LIVEKIT_URL

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 }
      )
    }

    const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret)

    const s3BucketName = process.env.S3_BUCKET_NAME || "jak-mpc-recorded-sessions-subjects-only"
    const filepath = `subject-only-sessions/${exerciseId || "session"}/${Date.now()}.mp4`

    // Start recording with composite output to S3
    const egress = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        fileType: EncodedFileType.MP4,
        filepath,
        s3: {
          accessKey: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
          secret: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || "us-east-2",
          bucket: s3BucketName,
        },
      },
      {
        layout: "speaker",
      }
    )

    return NextResponse.json(
      {
        recordingSid: egress.egressId,
        status: egress.status,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error starting recording:", error)
    return NextResponse.json(
      { error: error.message || "Failed to start recording" },
      { status: 500 }
    )
  }
}
