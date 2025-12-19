"use client"

import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  ParticipantTile,
  GridLayout,
  TrackRefContext,
  useLocalParticipant,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track, Room } from "livekit-client"
import { Loader2, MessageSquare, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { CustomVideoControls } from "@/components/custom-video-controls"

interface Exercise {
  id: string
  name: string
  description: string
  instructions: string[]
  weekly_frequency: number
}

function PracticeRoomContent({ exercise, onRecordingComplete }: { exercise: Exercise; onRecordingComplete: (videoUrl: string) => void }) {
  const room = useRoomContext()
  const { data: session } = useSession()
  const { isCameraEnabled, localParticipant } = useLocalParticipant()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [aiMessages, setAiMessages] = useState<string[]>([])
  const videoTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )
  const recordingRef = useRef<{ startTime: Date; room: Room; egressId: string } | null>(null)

  // Get participant name
  const participantName = session?.user?.name || session?.user?.email || "Participant"

  // Session duration timer
  useEffect(() => {
    if (!room) return

    const interval = setInterval(() => {
      setSessionDuration((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [room])

  // AI Assistant messages simulation
  useEffect(() => {
    if (!room || !isRecording) return

    const messages = [
      "Great! Let's start with proper form. Make sure your back is straight.",
      "Remember to breathe steadily throughout the exercise.",
      "Focus on controlled movements. Quality over speed!",
      "You're doing great! Keep up the good form.",
      "Take a moment to rest if needed. Listen to your body.",
    ]

    const interval = setInterval(() => {
      const randomMessage = messages[Math.floor(Math.random() * messages.length)]
      setAiMessages((prev) => [...prev.slice(-4), randomMessage])
    }, 15000) // New message every 15 seconds

    return () => clearInterval(interval)
  }, [room, isRecording])

  const handleStartRecording = async () => {
    try {
      if (!room || !room.name) {
        throw new Error("Room not ready")
      }

      // Start LiveKit recording
      const response = await fetch("/api/livekit/start-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: room.name,
          exerciseId: exercise.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to start recording")
      }

      const data = await response.json()
      
      setIsRecording(true)
      setRecordingStartTime(new Date())
      recordingRef.current = { 
        startTime: new Date(), 
        room,
        egressId: data.recordingSid || data.egressId
      }
      toast.success("Recording Started", {
        description: "Your practice session is being recorded.",
      })
    } catch (error: any) {
      console.error("Error starting recording:", error)
      toast.error("Recording Error", {
        description: error.message || "Failed to start recording",
      })
    }
  }

  const handleStopRecording = async () => {
    try {
      if (!recordingRef.current) return

      const egressId = recordingRef.current.egressId

      // Stop LiveKit recording
      const response = await fetch("/api/livekit/stop-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: room.name,
          egressId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to stop recording")
      }

      const data = await response.json()
      setIsRecording(false)
      setRecordingStartTime(null)
      const savedEgressId = recordingRef.current.egressId
      recordingRef.current = null

      toast.success("Recording Stopped", {
        description: "Your practice session has been saved and will be analyzed.",
      })

      // Trigger video upload and analysis
      if (savedEgressId || data.recordingSid) {
        onRecordingComplete(savedEgressId || data.recordingSid)
      }
    } catch (error: any) {
      console.error("Error stopping recording:", error)
      toast.error("Recording Error", {
        description: error.message || "Failed to stop recording",
      })
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-red-500/90 px-4 py-2 rounded-lg">
          <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
          <span className="text-white font-semibold">Recording</span>
        </div>
      )}

      {/* Video Grid */}
      <div className="flex-1 p-4">
        {videoTracks.length > 0 ? (
          <GridLayout tracks={videoTracks} className="h-full">
            <TrackRefContext.Consumer>
              {(trackRef) => {
                if (!trackRef) return null
                return (
                  <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-800">
                    <ParticipantTile trackRef={trackRef} />
                    {/* Participant name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-2">
                      <p className="font-medium text-white text-sm text-center truncate">
                        {trackRef.participant.identity === localParticipant?.identity
                          ? participantName
                          : trackRef.participant.name || trackRef.participant.identity}
                      </p>
                    </div>
                  </div>
                )
              }}
            </TrackRefContext.Consumer>
          </GridLayout>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-900 rounded-lg">
            <div className="text-center">
              <p className="text-white/70 mb-2">Waiting for camera...</p>
              <p className="text-white/50 text-sm">
                {isCameraEnabled ? "Camera enabled, initializing..." : "Please enable your camera"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Messages */}
      {aiMessages.length > 0 && (
        <div className="absolute bottom-24 left-4 right-4 z-10">
          <Card className="bg-black/80 backdrop-blur-sm border-white/20">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">AI Assistant</p>
                  <p className="text-sm text-white">{aiMessages[aiMessages.length - 1]}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Custom Video Controls with integrated record button */}
      <CustomVideoControls 
        sessionDuration={formatDuration(sessionDuration)}
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        showRecordButton={true}
      />

      <RoomAudioRenderer />
    </div>
  )
}

export default function PracticeSessionPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const exerciseId = params.exerciseId as string
  const [token, setToken] = useState<string | null>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://jak-fcjstami.livekit.cloud"

  // Validate LiveKit URL
  useEffect(() => {
    if (!livekitUrl || livekitUrl.trim() === "") {
      setError("LiveKit server URL is not configured. Please set NEXT_PUBLIC_LIVEKIT_URL environment variable.")
    }
  }, [livekitUrl])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in")
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id || !exerciseId) return

      try {
        // Fetch exercise details
        // exerciseId format: "subject_id-exercise_id" or just exercise_id
        const exerciseResponse = await fetch(`/api/prescribed-exercises/${exerciseId}`)
        if (!exerciseResponse.ok) {
          throw new Error("Failed to fetch exercise")
        }
        const exerciseData = await exerciseResponse.json()
        const prescribedExercise = exerciseData.exercise
        
        // Map to Exercise interface
        setExercise({
          id: prescribedExercise.id || exerciseId,
          name: prescribedExercise.exercise_name || prescribedExercise.name,
          description: prescribedExercise.exercise_description || prescribedExercise.description || "",
          instructions: prescribedExercise.instructions || [],
          weekly_frequency: prescribedExercise.weekly_frequency || 1,
        })

        // Create practice room and get token
        const roomName = `subject-only-session-${exerciseId}-${session.user.id}-${Date.now()}`
        
        // Create room
        await fetch("/api/livekit/create-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName }),
        })

        // Get token
        const tokenResponse = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName,
            participantName: session.user.email || session.user.name || "Member",
            participantIdentity: session.user.id,
          }),
        })

        if (!tokenResponse.ok) {
          throw new Error("Failed to get token")
        }

        const tokenData = await tokenResponse.json()
        setToken(tokenData.token)

        // Start AI assistant
        await fetch("/api/livekit/ai-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName }),
        })
      } catch (err: any) {
        setError(err.message || "Failed to initialize session")
        console.error("Error initializing practice session:", err)
      } finally {
        setIsLoading(false)
      }
    }

    if (session && exerciseId) {
      fetchData()
    }
  }, [session, exerciseId])

  const handleRecordingComplete = async (recordingSid: string) => {
    try {
      // Trigger video upload and analysis
      const response = await fetch("/api/subject-only-sessions/upload-and-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId,
          recordingSid,
          roomName: `subject-only-session-${exerciseId}-${session?.user?.id}`,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to upload and analyze video")
      }

      router.push("/prescribed-exercises")
    } catch (error: any) {
      console.error("Error uploading video:", error)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !exercise || !token || !livekitUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {error || !livekitUrl 
                ? "LiveKit server URL is not configured. Please set NEXT_PUBLIC_LIVEKIT_URL environment variable."
                : "Failed to load practice session"}
            </p>
            <Button onClick={() => router.push("/prescribed-exercises")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Exercises
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleMediaDeviceFailure = (failure: any, kind?: string) => {
    console.error("Media device failure:", failure, kind)
    if (kind === "videoinput" || kind === "camera") {
      toast.error("Camera Error", {
        description: "Unable to access camera. Please check permissions and try again.",
        duration: 5000,
      })
    }
  }

  const handleError = (error: Error) => {
    console.error("LiveKit error:", error)
    toast.error("Connection Error", {
      description: error.message || "Failed to connect to session",
    })
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      className="h-screen"
      onError={handleError}
      onMediaDeviceFailure={handleMediaDeviceFailure}
    >
      <PracticeRoomContent exercise={exercise} onRecordingComplete={handleRecordingComplete} />
    </LiveKitRoom>
  )
}

