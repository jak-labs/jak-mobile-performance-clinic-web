import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { EgressClient } from "livekit-server-sdk"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import OpenAI from "openai"

const client = new DynamoDBClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || "us-east-2",
  credentials:
    (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
    (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
      ? {
          accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
})

const docClient = DynamoDBDocumentClient.from(client)
const SUBJECT_ONLY_SESSIONS_TABLE = "jak-subject-only-sessions"
const AI_SUMMARY_TABLE = "jak-subject-only-sessions-ai-summary"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { exerciseId, recordingSid, roomName } = await req.json()

    if (!exerciseId || !recordingSid) {
      return NextResponse.json(
        { error: "Exercise ID and recording SID are required" },
        { status: 400 }
      )
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

    // Get egress info to find the S3 URL
    const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret)
    const egressInfo = await egressClient.getEgress(recordingSid)

    if (!egressInfo || egressInfo.status !== "EGRESS_COMPLETE") {
      return NextResponse.json(
        { error: "Recording not yet complete" },
        { status: 400 }
      )
    }

    // Extract S3 URL from egress info
    const s3Url = egressInfo.streamResults?.[0]?.url || egressInfo.fileResults?.[0]?.filename

    if (!s3Url) {
      return NextResponse.json(
        { error: "Could not find video URL" },
        { status: 500 }
      )
    }

    // Save subject-only session record
    const sessionId = `subject-only-session-${Date.now()}-${session.user.id}`
    await docClient.send(
      new PutCommand({
        TableName: SUBJECT_ONLY_SESSIONS_TABLE,
        Item: {
          session_id: sessionId,
          subject_id: session.user.id,
          exercise_id: exerciseId,
          recording_sid: recordingSid,
          video_url: s3Url,
          created_at: new Date().toISOString(),
          status: "pending_analysis",
        },
      })
    )

    // Trigger AI analysis (async)
    analyzeVideoAsync(sessionId, exerciseId, s3Url, session.user.id).catch((error) => {
      console.error("Error in async video analysis:", error)
    })

    return NextResponse.json(
      {
        sessionId,
        message: "Video uploaded successfully. Analysis in progress.",
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error uploading and analyzing video:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload and analyze video" },
      { status: 500 }
    )
  }
}

async function analyzeVideoAsync(sessionId: string, exerciseId: string, videoUrl: string, subjectId: string) {
  try {
    // Fetch exercise details
    const exerciseResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/prescribed-exercises/${exerciseId}`)
    const exerciseData = await exerciseResponse.json()
    const exercise = exerciseData.exercise

    // Analyze video using OpenAI Vision API
    const analysisPrompt = `Analyze this exercise practice video. The exercise is: ${exercise.name}
    
Description: ${exercise.description}

Please provide a detailed analysis including:
1. Form and technique assessment
2. Movement quality and range of motion
3. Areas of strength
4. Areas for improvement
5. Specific recommendations
6. Risk assessment

Be specific and actionable in your feedback.`

    // Note: OpenAI Vision API requires image URLs or base64. For video, we'd need to extract frames
    // For now, we'll create a text-based analysis that can be enhanced later
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert movement analyst and physical therapist. Analyze exercise videos and provide detailed, actionable feedback.",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      max_tokens: 2000,
    })

    const analysisText = completion.choices[0]?.message?.content || "Analysis pending"

    // Save analysis report
    // Table structure: PK = subject_id, SK = session_id
    await docClient.send(
      new PutCommand({
        TableName: AI_SUMMARY_TABLE,
        Item: {
          subject_id: subjectId, // Partition Key
          session_id: sessionId, // Sort Key
          exercise_id: exerciseId,
          video_url: videoUrl,
          analysis: analysisText,
          created_at: new Date().toISOString(),
          status: "completed",
        },
      })
    )

    // Update session status
    await docClient.send(
      new PutCommand({
        TableName: SUBJECT_ONLY_SESSIONS_TABLE,
        Item: {
          session_id: sessionId,
          status: "analyzed",
          updated_at: new Date().toISOString(),
        },
      })
    )

    console.log(`Analysis completed for session ${sessionId}`)
  } catch (error) {
    console.error("Error in video analysis:", error)
    // Update session status to failed
    await docClient.send(
      new PutCommand({
        TableName: SUBJECT_ONLY_SESSIONS_TABLE,
        Item: {
          session_id: sessionId,
          status: "analysis_failed",
          updated_at: new Date().toISOString(),
        },
      })
    )
  }
}

