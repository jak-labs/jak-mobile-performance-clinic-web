"use client"

import { useState, useEffect } from "react"
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
  ParticipantTile,
  useParticipants,
  ParticipantContext,
  TrackRefContext,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track, TrackPublication } from "livekit-client"
import MetricsDashboard from "./metrics-dashboard"
import { useV2 } from "@/lib/v2-context"

interface LiveKitVideoSessionProps {
  roomName: string
  sessionTitle?: string
  sessionOwnerId?: string | null
}

export default function LiveKitVideoSession({ roomName, sessionTitle, sessionOwnerId }: LiveKitVideoSessionProps) {
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
      className="relative w-full h-full bg-black overflow-hidden flex"
    >
      <RoomContent
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        participantNotes={participantNotes}
        setParticipantNotes={setParticipantNotes}
        handleAddNote={handleAddNote}
        sessionDuration={formatDuration(sessionDuration)}
        v2Enabled={v2Enabled}
        sessionOwnerId={sessionOwnerId}
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
  sessionOwnerId,
}: {
  isPanelOpen: boolean
  setIsPanelOpen: (open: boolean) => void
  participantNotes: { [key: string]: string }
  setParticipantNotes: (notes: { [key: string]: string }) => void
  handleAddNote: (id: string) => void
  sessionDuration: string
  v2Enabled: boolean
  sessionOwnerId?: string | null
}) {
  const { data: session } = useSession()
  const [isCoach, setIsCoach] = useState<boolean | null>(null)
  const [participantInfo, setParticipantInfo] = useState<Record<string, { firstName: string; lastName: string; fullName: string; label: string; role: string }>>({})
  const room = useRoomContext()
  const localParticipant = room.localParticipant
  const remoteParticipants = Array.from(room.remoteParticipants.values())
  
  // Get all video tracks
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  })

  // Fetch user role to identify coach
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/auth/user-groups")
        if (response.ok) {
          const data = await response.json()
          setIsCoach(data.isCoach || false)
        }
      } catch (error) {
        console.error("Error fetching user role:", error)
        setIsCoach(false)
      }
    }
    if (session) {
      fetchUserRole()
    }
  }, [session])

  // Get all participants using LiveKit hook
  const participants = useParticipants()

  // Fetch participant info (first name, last name, label) for all participants
  useEffect(() => {
    const fetchParticipantInfo = async () => {
      const allParticipants = [
        { identity: localParticipant.identity, isLocal: true },
        ...remoteParticipants.map((p) => ({ identity: p.identity, isLocal: false })),
      ]

      const infoPromises = allParticipants.map(async (p) => {
        // Skip if we already have info for this participant
        if (participantInfo[p.identity]) {
          return null
        }

        try {
          // Pass sessionOwnerId as query param to correctly identify the coach
          const url = sessionOwnerId 
            ? `/api/participants/${p.identity}?sessionOwnerId=${encodeURIComponent(sessionOwnerId)}`
            : `/api/participants/${p.identity}`
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            return {
              identity: p.identity,
              info: {
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                fullName: data.fullName || p.identity,
                label: data.label || 'Participant',
                role: data.role || 'unknown',
              },
            }
          }
        } catch (error) {
          console.error(`Error fetching info for participant ${p.identity}:`, error)
        }
        return null
      })

      const results = await Promise.all(infoPromises)
      const newInfo: typeof participantInfo = { ...participantInfo }
      
      results.forEach((result) => {
        if (result) {
          newInfo[result.identity] = result.info
        }
      })

      if (Object.keys(newInfo).length > Object.keys(participantInfo).length) {
        setParticipantInfo(newInfo)
      }
    }

    if (participants.length > 0) {
      fetchParticipantInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length, localParticipant.identity, remoteParticipants.length, sessionOwnerId])
  
  // Determine coach participant based on session owner (who created the session)
  // The coach is the participant whose identity matches the session's user_id (owner)
  let coachParticipant: typeof participants[0] | undefined
  
  if (sessionOwnerId) {
    // Find the participant whose identity matches the session owner's ID
    coachParticipant = participants.find((p) => p.identity === sessionOwnerId)
  }
  
  // Fallback: if coach not identified, use first participant
  if (!coachParticipant && participants.length > 0) {
    coachParticipant = participants[0]
  }
  
  // Other participants are everyone except the coach
  const otherParticipants = participants.filter((p) => p.identity !== coachParticipant?.identity)
  
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
          isPanelOpen ? "md:w-[60%] w-full" : "w-full"
        }`}
      >
        {/* Main video area - Clean, minimal layout */}
        <div className="h-full min-h-0 flex flex-col md:flex-row gap-0 p-0 overflow-y-auto md:overflow-hidden">
          {/* Coach video - large main view with clean styling */}
          <div className="flex-1 min-h-0 relative overflow-hidden bg-black md:border-r border-border/50">
            {coachParticipant ? (() => {
              const coachTrackRef = getTrackForParticipant(coachParticipant.identity)
              return (
                <ParticipantContext.Provider value={coachParticipant}>
                  {coachTrackRef ? (
                    <TrackRefContext.Provider value={coachTrackRef}>
                      <ParticipantTile className="h-full w-full" />
                    </TrackRefContext.Provider>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gray-900">
                      <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-3xl font-medium text-white">
                          {(coachParticipant.name || coachParticipant.identity).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 md:px-4 py-2 md:py-2.5 rounded-lg border border-white/10 z-10 shadow-lg">
                    {(() => {
                      const info = participantInfo[coachParticipant.identity]
                      const firstName = info?.firstName || ''
                      const lastName = info?.lastName || ''
                      const label = info?.label || 'Coach'
                      const isLocal = coachParticipant.identity === localParticipant.identity
                      
                      return (
                        <div className="flex flex-col gap-0.5">
                          {(firstName || lastName) ? (
                            <>
                              <p className="text-sm md:text-base font-semibold text-white">
                                {firstName} {lastName}
                              </p>
                              <p className="text-xs md:text-sm text-white/70">
                                {label} {isLocal ? "• You" : ""}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm md:text-base font-medium text-white">
                              {coachParticipant.name || coachParticipant.identity} {isLocal ? "(You - Coach)" : "(Coach)"}
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  {(() => {
                    const audioPublications = [...coachParticipant.audioTrackPublications.values()]
                    const audioPublication = audioPublications[0]
                    const isMuted = !audioPublication || !audioPublication.isSubscribed || audioPublication.isMuted
                    return isMuted ? (
                      <div className="absolute top-2 right-2 bg-destructive p-2 rounded-full z-10">
                        <MicOff className="h-4 w-4 text-destructive-foreground" />
                      </div>
                    ) : null
                  })()}
                </ParticipantContext.Provider>
              )
            })() : (
              <div className="h-full w-full flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl font-medium text-white">
                      {localParticipant.name?.charAt(0).toUpperCase() || "C"}
                    </span>
                  </div>
                  <p className="text-muted-foreground">Waiting for coach...</p>
                </div>
              </div>
            )}
          </div>

          {/* Other participants - Clean carousel layout */}
          {otherParticipants.length > 0 && (
            <div className="md:w-72 w-full flex md:flex-col flex-row gap-3 overflow-x-auto md:overflow-y-auto overflow-y-hidden p-3 md:h-auto h-28 sm:h-36 flex-shrink-0 scrollbar-hide" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0))' }}>
              {otherParticipants.map((participant) => {
                const isLocal = participant.identity === localParticipant.identity
                const audioPublications = [...participant.audioTrackPublications.values()]
                const audioPublication = audioPublications[0]
                const isMuted = !audioPublication || !audioPublication.isSubscribed || audioPublication.isMuted
                
                return (
                  <div
                    key={participant.identity}
                    className="relative rounded-xl overflow-hidden bg-black border border-white/10 flex-shrink-0 md:h-[200px] h-full w-56 md:w-auto shadow-lg hover:border-white/20 transition-colors"
                  >
                    <ParticipantContext.Provider value={participant}>
                      {(() => {
                        const participantTrackRef = getTrackForParticipant(participant.identity)
                        return participantTrackRef ? (
                          <TrackRefContext.Provider value={participantTrackRef}>
                            <ParticipantTile className="h-full w-full" />
                          </TrackRefContext.Provider>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gray-900">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-xl font-medium text-white">
                                {(participant.name || participant.identity).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </ParticipantContext.Provider>
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 z-10 shadow-lg">
                      {(() => {
                        const info = participantInfo[participant.identity]
                        const firstName = info?.firstName || ''
                        const lastName = info?.lastName || ''
                        const label = info?.label || 'Participant'
                        
                        return (firstName || lastName) ? (
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs font-semibold text-white truncate max-w-[180px]">
                              {firstName} {lastName}
                            </p>
                            <p className="text-[10px] text-white/70 truncate max-w-[180px]">
                              {label} {isLocal ? "• You" : ""}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-white truncate max-w-[180px]">
                            {participant.name || participant.identity} {isLocal ? "(You)" : ""}
                          </p>
                        )
                      })()}
                    </div>
                    {isMuted && (
                      <div className="absolute top-1 right-1 bg-destructive p-1.5 rounded-full z-10">
                        <MicOff className="h-3 w-3 text-destructive-foreground" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Controls - Clean, minimal design inspired by LiveKit Agents */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 bg-black/80 backdrop-blur-xl px-4 md:px-8 py-3 md:py-4 rounded-2xl border border-white/10 shadow-2xl z-50 max-w-[calc(100vw-2rem)] md:max-w-none" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0))', marginBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0))' }}>
          <TrackToggle source={Track.Source.Microphone} className="rounded-full h-11 w-11 md:h-14 md:w-14 flex-shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 transition-all" />
          <TrackToggle source={Track.Source.Camera} className="rounded-full h-11 w-11 md:h-14 md:w-14 flex-shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 transition-all" />
          <DisconnectButton className="rounded-full h-11 w-11 md:h-14 md:w-14 bg-red-500/90 hover:bg-red-600 border border-red-400/50 flex-shrink-0 transition-all shadow-lg">
            <PhoneOff className="h-5 w-5 md:h-6 md:w-6" />
          </DisconnectButton>
        </div>

        {/* Session info - Clean, minimal badges */}
        <div className="absolute top-4 md:top-6 left-4 md:left-6 bg-black/60 backdrop-blur-md px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-white/10 z-10 shadow-lg">
          <p className="text-[10px] md:text-xs text-white/60 uppercase tracking-wider mb-1">Session Duration</p>
          <p className="text-sm md:text-base font-mono font-semibold text-white">{sessionDuration}</p>
        </div>

        <div className="absolute top-4 md:top-6 right-4 md:right-6 flex items-center gap-2 md:gap-2.5 bg-black/60 backdrop-blur-md px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-white/10 z-10 shadow-lg">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
          <span className="text-xs md:text-sm font-medium text-white">Connected</span>
        </div>
      </div>

      <Button
        variant="secondary"
        size="icon"
        className={`hidden md:flex absolute top-1/2 -translate-y-1/2 h-16 w-12 rounded-2xl shadow-lg z-20 transition-all duration-300 ${
          isPanelOpen ? "right-[40%]" : "right-4"
        }`}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        {isPanelOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>

      <div
        className={`hidden md:flex h-full border-l bg-background flex-col transition-all duration-300 ease-in-out overflow-hidden ${
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
            {participants
              .filter((p) => p.identity !== localParticipant.identity)
              .map((participant) => (
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

