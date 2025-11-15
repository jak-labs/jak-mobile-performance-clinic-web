"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, ChevronLeft, ChevronRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "next-auth/react"
import {
  LiveKitRoom,
  VideoTrack,
  RoomAudioRenderer,
  useRoomContext,
  TrackToggle,
  DisconnectButton,
  useTracks,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track, TrackPublication } from "livekit-client"
import MetricsDashboard from "./metrics-dashboard"
import { useV2 } from "@/lib/v2-context"

interface LiveKitVideoSessionProps {
  roomName: string
  sessionTitle?: string
}

export default function LiveKitVideoSession({ roomName, sessionTitle }: LiveKitVideoSessionProps) {
  const { data: session } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [participantNotes, setParticipantNotes] = useState<{ [key: string]: string }>({})
  const { v2Enabled } = useV2()
  const [sessionDuration, setSessionDuration] = useState(0)

  // Fetch LiveKit token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomName,
            participantName: session?.user?.email || session?.user?.name || "Participant",
            participantIdentity: session?.user?.id || "user",
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch token")
        }

        const data = await response.json()
        setToken(data.token)
      } catch (error) {
        console.error("Error fetching LiveKit token:", error)
      } finally {
        setIsConnecting(false)
      }
    }

    if (roomName && session?.user?.id) {
      fetchToken()
    }
  }, [roomName, session])

  // Session duration timer
  useEffect(() => {
    if (!token) return

    const interval = setInterval(() => {
      setSessionDuration((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [token])

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleAddNote = (participantId: string) => {
    const note = participantNotes[participantId]
    if (note?.trim()) {
      console.log(`Adding note for participant ${participantId}:`, note)
      setParticipantNotes({ ...participantNotes, [participantId]: "" })
    }
  }

  if (isConnecting || !token) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to session...</p>
        </div>
      </div>
    )
  }

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://jak-fcjstami.livekit.cloud"

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      className="relative w-full h-full bg-secondary overflow-hidden flex"
    >
      <RoomContent
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        participantNotes={participantNotes}
        setParticipantNotes={setParticipantNotes}
        handleAddNote={handleAddNote}
        sessionDuration={formatDuration(sessionDuration)}
        v2Enabled={v2Enabled}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

function RoomContent({
  isPanelOpen,
  setIsPanelOpen,
  participantNotes,
  setParticipantNotes,
  handleAddNote,
  sessionDuration,
  v2Enabled,
}: {
  isPanelOpen: boolean
  setIsPanelOpen: (open: boolean) => void
  participantNotes: { [key: string]: string }
  setParticipantNotes: (notes: { [key: string]: string }) => void
  handleAddNote: (id: string) => void
  sessionDuration: string
  v2Enabled: boolean
}) {
  const room = useRoomContext()
  const localParticipant = room.localParticipant
  const remoteParticipants = Array.from(room.remoteParticipants.values())
  
  // Get all video tracks
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  })

  const allParticipants = [
    { participant: localParticipant, isLocal: true },
    ...remoteParticipants.map((p) => ({ participant: p, isLocal: false })),
  ]
  
  // Helper to get track for a participant
  const getTrackForParticipant = (participantIdentity: string) => {
    return tracks.find(
      (track) => track.participant.identity === participantIdentity && track.source === Track.Source.Camera
    )
  }

  return (
    <>
      <div
        className={`relative h-full flex flex-col transition-all duration-300 ease-in-out ${
          isPanelOpen ? "w-[60%]" : "w-full"
        }`}
      >
        <div
          className={`h-full min-h-0 grid gap-2 p-2 transition-all duration-300 ${
            isPanelOpen && allParticipants.length > 1
              ? "grid-cols-1 grid-rows-2"
              : allParticipants.length > 1
              ? "grid-cols-2 grid-rows-1"
              : "grid-cols-1 grid-rows-1"
          }`}
        >
          {allParticipants.map(({ participant, isLocal }) => {
            const trackRef = getTrackForParticipant(participant.identity)
            const audioPublication = Array.from(participant.audioTrackPublications.values())[0]
            const isMuted = !audioPublication || !audioPublication.isSubscribed || audioPublication.isMuted
            
            return (
              <div
                key={participant.identity}
                className={`relative rounded-lg overflow-hidden bg-black min-h-0 ${
                  isLocal ? "border-2 border-primary" : "border border-border"
                }`}
              >
                {trackRef ? (
                  <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-2xl font-medium text-white">
                        {(participant.name || participant.identity).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded">
                  <p className="text-sm font-medium text-white">
                    {participant.name || participant.identity} {isLocal ? "(You)" : ""}
                  </p>
                </div>

                {isLocal && isMuted && (
                  <div className="absolute top-2 right-2 bg-destructive p-2 rounded-full">
                    <MicOff className="h-4 w-4 text-destructive-foreground" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-background/95 backdrop-blur-sm px-6 py-3 rounded-full border shadow-lg z-10">
          <TrackToggle source={Track.Source.Microphone} className="rounded-full h-12 w-12" />
          <TrackToggle source={Track.Source.Camera} className="rounded-full h-12 w-12" />
          <DisconnectButton className="rounded-full h-12 w-12 bg-destructive hover:bg-destructive/90">
            <PhoneOff className="h-5 w-5" />
          </DisconnectButton>
        </div>

        <div className="absolute top-4 left-20 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg border z-10">
          <p className="text-xs text-muted-foreground">Session Duration</p>
          <p className="text-sm font-mono font-semibold">{sessionDuration}</p>
        </div>

        <div className="absolute top-4 right-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg border z-10">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium">Connected</span>
        </div>
      </div>

      <Button
        variant="secondary"
        size="icon"
        className={`absolute top-1/2 -translate-y-1/2 h-16 w-12 rounded-2xl shadow-lg z-20 transition-all duration-300 ${
          isPanelOpen ? "right-[40%]" : "right-4"
        }`}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        {isPanelOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>

      <div
        className={`h-full border-l bg-background flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isPanelOpen ? "w-[40%] min-w-[500px] max-w-[700px]" : "w-0 min-w-0 border-0"
        }`}
      >
        <Tabs defaultValue="session" className="flex-1 flex flex-col h-full">
          <div className="border-b">
            <TabsList className="w-full rounded-none border-0">
              {v2Enabled && (
                <TabsTrigger value="metrics" className="flex-1">
                  Live Metrics
                </TabsTrigger>
              )}
              <TabsTrigger value="session" className="flex-1">
                Session
              </TabsTrigger>
            </TabsList>
          </div>

          {v2Enabled && (
            <TabsContent
              value="metrics"
              className="flex-1 overflow-y-auto scrollbar-hide mt-0 p-0 h-[calc(100vh-120px)]"
            >
              <MetricsDashboard />
            </TabsContent>
          )}

          <TabsContent
            value="session"
            className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide mt-0 h-[calc(100vh-120px)]"
          >
            <h3 className="font-semibold text-sm">Participants</h3>
            {allParticipants
              .filter((p) => !p.isLocal)
              .map(({ participant }) => (
                <Card key={participant.identity} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {(participant.name || participant.identity).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-sm">{participant.name || participant.identity}</span>
                  </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Add Note</label>
                  <Textarea
                    placeholder="Type session notes..."
                    value={participantNotes[participant.identity] || ""}
                    onChange={(e) =>
                      setParticipantNotes({
                        ...participantNotes,
                        [participant.identity]: e.target.value,
                      })
                    }
                    className="min-h-[60px] text-sm"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleAddNote(participant.identity)}
                    disabled={!participantNotes[participant.identity]?.trim()}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Save Note
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

