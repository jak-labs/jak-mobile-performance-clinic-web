import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"

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
const EXERCISE_CATALOG_TABLE = "jak-exercise-catalog"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Scan all exercises from catalog
    const result = await docClient.send(
      new ScanCommand({
        TableName: EXERCISE_CATALOG_TABLE,
      })
    )

    const exercises = (result.Items || []).map((item) => ({
      id: item.exercise_id,
      name: item.name,
      description: item.description || "",
      category: item.category || "all",
      difficulty: item.difficulty || "Beginner",
      duration: item.duration || "",
      equipment: item.equipment || [],
      muscles: item.muscles || [],
      instructions: item.instructions || [],
      benefits: item.benefits || [],
      videoUrl: item.video_url,
    }))

    return NextResponse.json({ exercises }, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching exercises:", error)
    
    // If table doesn't exist yet, return empty array
    if (error.name === "ResourceNotFoundException") {
      return NextResponse.json({ exercises: [] }, { status: 200 })
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch exercises" },
      { status: 500 }
    )
  }
}

