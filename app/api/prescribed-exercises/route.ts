import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb"

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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Query prescribed exercises for this member
    // Using subject_id as partition key (member is a subject)
    const result = await docClient.send(
      new QueryCommand({
        TableName: PRESCRIBED_EXERCISES_TABLE,
        KeyConditionExpression: "subject_id = :subjectId",
        FilterExpression: "#status <> :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":subjectId": session.user.id,
          ":status": "deleted",
        },
      })
    )

    const exercises = (result.Items || []).map((item) => ({
      id: `${item.subject_id}-${item.exercise_id}`, // Composite ID for prescription
      exercise_id: item.exercise_id,
      exercise_name: item.exercise_name || "Unknown Exercise",
      exercise_description: item.exercise_description || "",
      weekly_frequency: item.weekly_frequency || 1,
      prescribed_date: item.prescribed_date || item.created_at,
      status: item.status || "active",
      coach_name: item.coach_name,
    }))

    return NextResponse.json({ exercises }, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching prescribed exercises:", error)
    
    // If table doesn't exist yet, return empty array
    if (error.name === "ResourceNotFoundException") {
      return NextResponse.json({ exercises: [] }, { status: 200 })
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch prescribed exercises" },
      { status: 500 }
    )
  }
}

