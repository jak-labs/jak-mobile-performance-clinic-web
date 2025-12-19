import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { EgressClient } from "livekit-server-sdk"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { roomName, egressId } = await req.json()

    if (!roomName && !egressId) {
      return NextResponse.json({ error: "Room name or egress ID is required" }, { status: 400 })
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

    let targetEgressId = egressId

    // If egressId not provided, find active recording for room
    if (!targetEgressId && roomName) {
      const egresses = await egressClient.listEgress({
        roomName,
        active: true,
      })

      if (egresses.items.length === 0) {
        return NextResponse.json({ error: "No active recording found" }, { status: 404 })
      }

      targetEgressId = egresses.items[0].egressId
    }

    if (!targetEgressId) {
      return NextResponse.json({ error: "No recording found to stop" }, { status: 404 })
    }

    // Stop the recording
    await egressClient.stopEgress(targetEgressId)

    return NextResponse.json(
      {
        recordingSid: targetEgressId,
        egressId: targetEgressId,
        status: "stopped",
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error stopping recording:", error)
    return NextResponse.json(
      { error: error.message || "Failed to stop recording" },
      { status: 500 }
    )
  }
}

