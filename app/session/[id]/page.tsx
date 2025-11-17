"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import LiveKitVideoSession from "@/components/livekit-video-session"
import { Loader2 } from "lucide-react"

export default function SessionPage() {
  const params = useParams()
  const sessionId = params.id as string
  const [roomName, setRoomName] = useState<string | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string>("")
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null)
  const [sessionType, setSessionType] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch session")
        }

        const data = await response.json()
        const session = data.session

        if (!session) {
          throw new Error("Session not found")
        }

        setSessionTitle(session.title || "Session")
        setSessionOwnerId(session.user_id || null)
        setSessionType(session.session_type || null) // "single" or "group"
        
        // Use livekit_room_name if available, otherwise generate from session_id
        const room = session.livekit_room_name || `session-${sessionId}`
        setRoomName(room)
      } catch (err: any) {
        console.error("Error fetching session:", err)
        setError(err.message || "Failed to load session")
      } finally {
        setIsLoading(false)
      }
    }

    if (sessionId) {
      fetchSession()
    }
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error || !roomName) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Session not found"}</p>
          <a href="/" className="text-primary hover:underline">
            Return to calendar
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
      <LiveKitVideoSession 
        roomName={roomName} 
        sessionTitle={sessionTitle} 
        sessionOwnerId={sessionOwnerId}
        sessionType={sessionType}
      />
    </div>
  )
}
