import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import { getUserProfile } from "@/lib/dynamodb"

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
const EXERCISE_CATALOG_TABLE = "jak-exercise-catalog"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { exerciseId, subjectIds, weeklyFrequency } = await req.json()

    if (!exerciseId || !subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json(
        { error: "Exercise ID and at least one subject ID are required" },
        { status: 400 }
      )
    }

    if (!weeklyFrequency || weeklyFrequency < 1) {
      return NextResponse.json(
        { error: "Weekly frequency must be at least 1" },
        { status: 400 }
      )
    }

    // Get coach profile for name
    const coachProfile = await getUserProfile(session.user.id)
    const coachName = coachProfile?.fullName || coachProfile?.f_name || session.user.email || "Coach"

    // Get exercise details from catalog directly from DynamoDB
    const exerciseResult = await docClient.send(
      new GetCommand({
        TableName: EXERCISE_CATALOG_TABLE,
        Key: {
          exercise_id: exerciseId,
        },
      })
    )

    if (!exerciseResult.Item) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 })
    }

    const exercise = {
      id: exerciseResult.Item.exercise_id,
      name: exerciseResult.Item.name,
      description: exerciseResult.Item.description || "",
      instructions: exerciseResult.Item.instructions || [],
    }

    const timestamp = new Date().toISOString()

    // Prescribe exercise to each subject
    const prescriptions = await Promise.all(
      subjectIds.map(async (subjectId: string) => {
        const item = {
          subject_id: subjectId, // Partition key
          exercise_id: exerciseId, // Sort key
          exercise_name: exercise.name,
          exercise_description: exercise.description,
          instructions: exercise.instructions || [],
          weekly_frequency: weeklyFrequency,
          prescribed_date: timestamp,
          coach_id: session.user.id,
          coach_name: coachName,
          status: "active",
          created_at: timestamp,
          updated_at: timestamp,
        }

        await docClient.send(
          new PutCommand({
            TableName: PRESCRIBED_EXERCISES_TABLE,
            Item: item,
          })
        )

        return item
      })
    )

    return NextResponse.json(
      {
        message: `Successfully prescribed exercise to ${prescriptions.length} client(s)`,
        prescriptions,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error prescribing exercise:", error)
    return NextResponse.json(
      { error: error.message || "Failed to prescribe exercise" },
      { status: 500 }
    )
  }
}

