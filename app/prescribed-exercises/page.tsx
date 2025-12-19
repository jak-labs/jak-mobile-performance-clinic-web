"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Calendar, Target } from "lucide-react"
import { useRouter } from "next/navigation"

interface PrescribedExercise {
  id: string
  exercise_id: string
  exercise_name: string
  exercise_description: string
  weekly_frequency: number
  prescribed_date: string
  status: "active" | "completed" | "paused"
  coach_name?: string
}

export default function PrescribedExercisesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [exercises, setExercises] = useState<PrescribedExercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in")
    }
  }, [status, router])

  useEffect(() => {
    const fetchExercises = async () => {
      if (!session?.user?.id) return

      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/prescribed-exercises")
        if (!response.ok) {
          throw new Error("Failed to fetch prescribed exercises")
        }
        const data = await response.json()
        setExercises(data.exercises || [])
      } catch (err: any) {
        setError(err.message || "Failed to load exercises")
        console.error("Error fetching prescribed exercises:", err)
      } finally {
        setIsLoading(false)
      }
    }

    if (session) {
      fetchExercises()
    }
  }, [session])

  const handleStartPractice = (exerciseId: string) => {
    router.push(`/subject-only-session/${exerciseId}`)
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prescribed Exercises</h1>
        <p className="text-muted-foreground">
          Exercises assigned by your coach.
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {exercises.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No exercises prescribed yet</h3>
            <p className="text-muted-foreground">
              Your coach will assign exercises for you to practice. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exercises.map((exercise) => (
            <Card key={exercise.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <CardTitle className="text-xl">{exercise.exercise_name}</CardTitle>
                  <Badge
                    variant={
                      exercise.status === "active"
                        ? "default"
                        : exercise.status === "completed"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {exercise.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {exercise.exercise_description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {exercise.weekly_frequency} time{exercise.weekly_frequency !== 1 ? "s" : ""} per week
                    </span>
                  </div>
                  {exercise.coach_name && (
                    <div className="text-sm text-muted-foreground">
                      Prescribed by: <span className="font-medium">{exercise.coach_name}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Assigned: {new Date(exercise.prescribed_date).toLocaleDateString()}
                  </div>
                </div>
                {exercise.status === "active" && (
                  <Button
                    onClick={() => handleStartPractice(exercise.exercise_id)}
                    className="w-full mt-auto"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Practice Session
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

