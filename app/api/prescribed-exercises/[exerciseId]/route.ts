import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"

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
const PRESCRIBED_EXERCISES_TABLE = "jak-prescribed-exercises"

export async function GET(req: NextRequest, { params }: { params: { exerciseId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { exerciseId } = params

    // Get prescribed exercise details
    // exerciseId format: "subject_id-exercise_id" or just exercise_id
    // If format is "subject_id-exercise_id", split it
    let subjectId = session.user.id
    let exerciseIdOnly = exerciseId

    if (exerciseId.includes("-")) {
      const parts = exerciseId.split("-")
      if (parts.length >= 2) {
        // Check if first part matches user ID (it's a prescription ID)
        const possibleSubjectId = parts[0]
        if (possibleSubjectId === session.user.id) {
          subjectId = possibleSubjectId
          exerciseIdOnly = parts.slice(1).join("-")
        } else {
          // It's just exercise_id, use current user as subject_id
          exerciseIdOnly = exerciseId
        }
      }
    }

    const result = await docClient.send(
      new GetCommand({
        TableName: PRESCRIBED_EXERCISES_TABLE,
        Key: {
          subject_id: subjectId,
          exercise_id: exerciseIdOnly,
        },
      })
    )

    if (!result.Item) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 })
    }

    if (!result.Item) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 })
    }

    // Verify this exercise belongs to the member
    if (result.Item.subject_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch exercise details from exercises catalog (if needed)
    // For now, return the prescribed exercise data
    const exercise = {
      id: result.Item.exercise_id,
      name: result.Item.exercise_name || "Unknown Exercise",
      description: result.Item.exercise_description || "",
      instructions: result.Item.instructions || [],
      weekly_frequency: result.Item.weekly_frequency || 1,
    }

    return NextResponse.json({ exercise }, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching exercise:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch exercise" },
      { status: 500 }
    )
  }
}

