"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, ChevronLeft, ChevronRight, Phone, Grid3x3, User, LayoutGrid, XCircle, Loader2 } from "lucide-react"
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
  useTracks,
  ParticipantTile,
  useParticipants,
  ParticipantContext,
  TrackRefContext,
  GridLayout,
  FocusLayout,
  FocusLayoutContainer,
  CarouselLayout,
  ControlBar,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track, TrackPublication } from "livekit-client"
import MetricsDashboard from "./metrics-dashboard"
import { useV2 } from "@/lib/v2-context"
import { AIInsightsPanel } from "./ai-insights-panel"
import { ChatPanel } from "./chat-panel"
import { CustomVideoControls } from "./custom-video-controls"
import { RealtimeMetricsProvider, useRealtimeMetrics } from "@/lib/realtime-metrics-context"
import { LiveMetricsTab } from "./live-metrics-tab"
import { BaseballMetricsTab } from "./baseball-metrics-tab"
import { BaseballInsightsPanel } from "./baseball-insights-panel"
import { BaseballChatPanel } from "./baseball-chat-panel"

type LayoutMode = 'default' | 'grid' | 'spotlight' | 'one-on-one'

interface LiveKitVideoSessionProps {
  roomName: string
  sessionTitle?: string
  sessionOwnerId?: string | null
  sessionType?: string | null // "single" or "group"
  sessionId?: string | null
}

export default function LiveKitVideoSession({ roomName, sessionTitle, sessionOwnerId, sessionType, sessionId }: LiveKitVideoSessionProps) {
  const { data: session } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(40) // Percentage of screen width (0-100)
  const [isResizing, setIsResizing] = useState(false)
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

  // Handle panel resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const windowWidth = window.innerWidth
    const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100

    // Constrain: min 0% (fully closed), max 50% (half screen)
    const constrainedWidth = Math.max(0, Math.min(50, newWidth))
    setPanelWidth(constrainedWidth)
    
    // Update isPanelOpen based on width
    setIsPanelOpen(constrainedWidth > 0)
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Sync isPanelOpen with panelWidth
  useEffect(() => {
    setIsPanelOpen(panelWidth > 0)
  }, [panelWidth])

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleAddNote = (participantId: string) => {
    const note = participantNotes[participantId]
    if (note?.trim()) {
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
    <RealtimeMetricsProvider>
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        className="relative w-full h-full bg-[#0a0a0a] overflow-hidden flex"
      >
        <RoomContent
          isPanelOpen={isPanelOpen}
          setIsPanelOpen={setIsPanelOpen}
          panelWidth={panelWidth}
          setPanelWidth={setPanelWidth}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
          handleMouseDown={handleMouseDown}
          participantNotes={participantNotes}
          setParticipantNotes={setParticipantNotes}
          handleAddNote={handleAddNote}
          sessionDuration={formatDuration(sessionDuration)}
          v2Enabled={v2Enabled}
          sessionOwnerId={sessionOwnerId}
          sessionType={sessionType}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </RealtimeMetricsProvider>
  )
}

function RoomContent({
  isPanelOpen,
  setIsPanelOpen,
  panelWidth,
  setPanelWidth,
  isResizing,
  setIsResizing,
  handleMouseDown,
  participantNotes,
  setParticipantNotes,
  handleAddNote,
  sessionDuration,
  v2Enabled,
  sessionOwnerId,
  sessionType,
  sessionId,
  sessionTitle,
}: {
  isPanelOpen: boolean
  setIsPanelOpen: (open: boolean) => void
  panelWidth: number
  setPanelWidth: (width: number) => void
  isResizing: boolean
  setIsResizing: (resizing: boolean) => void
  handleMouseDown: (e: React.MouseEvent) => void
  participantNotes: { [key: string]: string }
  setParticipantNotes: (notes: { [key: string]: string }) => void
  handleAddNote: (id: string) => void
  sessionDuration: string
  v2Enabled: boolean
  sessionOwnerId?: string | null
  sessionType?: string | null
  sessionId?: string | null
  sessionTitle?: string | null
}) {
  const router = useRouter()
  const { realtimeData } = useRealtimeMetrics()
  // Layout state management
  // Initialize layout to 'spotlight' (FocusLayout) by default for all session types
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('spotlight')
  const [spotlightParticipantId, setSpotlightParticipantId] = useState<string | null>(null)
  const { data: session } = useSession()
  
  // Keep spotlight as default - no need to change based on session type
  // Users can manually switch to grid if they prefer
  const [isCoach, setIsCoach] = useState<boolean | null>(null)
  const [participantInfo, setParticipantInfo] = useState<Record<string, { firstName: string; lastName: string; fullName: string; label: string; role: string }>>({})
  const fetchedParticipantsRef = useRef<Set<string>>(new Set())
  const [expectedParticipants, setExpectedParticipants] = useState<Array<{ id: string; name: string; isConnected: boolean }>>([])
  const [isLoadingExpectedParticipants, setIsLoadingExpectedParticipants] = useState(true)
  const [isEndingSession, setIsEndingSession] = useState(false)
  const [participantMetrics, setParticipantMetrics] = useState<Record<string, { balance: number; symmetry: number; postural: number }>>({})
  const [sessionSubjectId, setSessionSubjectId] = useState<string | null>(null)
  const room = useRoomContext()
  const localParticipant = room.localParticipant
  const remoteParticipants = Array.from(room.remoteParticipants.values())
  
  // Handle room disconnect - navigate to schedule screen
  useEffect(() => {
    if (!room) return

    const handleDisconnected = () => {
      console.log('[Client] Room disconnected event fired - redirecting to dashboard')
      // Use setTimeout to ensure the disconnect completes before navigation
      setTimeout(() => {
        router.push('/')
      }, 100)
    }

    room.on('disconnected', handleDisconnected)

    return () => {
      room.off('disconnected', handleDisconnected)
    }
  }, [room, router])
  
  // Get all video tracks
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  })

  // Custom controls state - commented out for testing LiveKit standard controls
  // const [isMicMuted, setIsMicMuted] = useState(true)
  // const [isCameraOff, setIsCameraOff] = useState(true)

  // useEffect(() => {
  //   const updateTrackStates = () => {
  //     const micPublications = Array.from(localParticipant.audioTrackPublications.values())
  //     const cameraPublications = Array.from(localParticipant.videoTrackPublications.values())
  //     const micPublication = micPublications.find(pub => pub.source === Track.Source.Microphone)
  //     const cameraPublication = cameraPublications.find(pub => pub.source === Track.Source.Camera)
  //     
  //     setIsMicMuted(micPublication ? micPublication.isMuted : true)
  //     setIsCameraOff(!cameraPublication || !cameraPublication.isSubscribed || cameraPublication.isMuted)
  //   }

  //   updateTrackStates()

  //   // Listen for track publication changes
  //   const handleTrackPublished = () => updateTrackStates()
  //   const handleTrackUnpublished = () => updateTrackStates()
  //   const handleTrackMuted = () => updateTrackStates()
  //   const handleTrackUnmuted = () => updateTrackStates()

  //   localParticipant.on('trackPublished', handleTrackPublished)
  //   localParticipant.on('trackUnpublished', handleTrackUnpublished)
  //   localParticipant.on('trackMuted', handleTrackMuted)
  //   localParticipant.on('trackUnmuted', handleTrackUnmuted)

  //   return () => {
  //     localParticipant.off('trackPublished', handleTrackPublished)
  //     localParticipant.off('trackUnpublished', handleTrackUnpublished)
  //     localParticipant.off('trackMuted', handleTrackMuted)
  //     localParticipant.off('trackUnmuted', handleTrackUnmuted)
  //   }
  // }, [localParticipant])

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
  // useParticipants() returns all participants including local participant
  const participantsFromHook = useParticipants()
  
  // Also get participants directly from room to ensure we have all of them
  const allRoomParticipants = [
    localParticipant,
    ...Array.from(room.remoteParticipants.values())
  ]
  
  // Use room participants if hook is missing any (more reliable)
  const participants = allRoomParticipants.length >= participantsFromHook.length 
    ? allRoomParticipants 
    : participantsFromHook
  
  // Track which participants we've fetched to avoid duplicate calls
  const fetchInitiatedRef = useRef<Set<string>>(new Set())
  
  // Fetch participant info directly when participants are available
  // This runs on every render but only fetches for new participants
  const participantIdentities = participants
    .map(p => p.identity)
    .filter(id => id && id.trim() !== '')
  
  const newParticipants = participantIdentities.filter(id => !fetchInitiatedRef.current.has(id))
  
  if (newParticipants.length > 0 && localParticipant?.identity) {
    newParticipants.forEach(id => fetchInitiatedRef.current.add(id))
    
    // Trigger fetch asynchronously
    Promise.resolve().then(async () => {
    const fetchParticipantInfo = async () => {
      const allParticipants = [
        { identity: localParticipant.identity, isLocal: true },
        ...remoteParticipants.map((p) => ({ identity: p.identity, isLocal: false })),
      ]

      // Helper function to fetch with timeout and retry
      const fetchWithRetry = async (identity: string, retries = 2): Promise<any> => {
        const params = new URLSearchParams()
        if (sessionOwnerId) {
          params.append('sessionOwnerId', sessionOwnerId)
        }
        if (sessionId) {
          params.append('sessionId', sessionId)
        }
        const queryString = params.toString()
        const url = `/api/participants/${encodeURIComponent(identity)}${queryString ? `?${queryString}` : ''}`
        
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), 5000)
            )
            
            const response = await Promise.race([
              fetch(url),
              timeoutPromise
            ]) as Response
            
          if (response.ok) {
            const data = await response.json()
            
            const firstName = data.firstName || ''
            const lastName = data.lastName || ''
              let fullName = ''
              if (firstName && lastName) {
                fullName = `${firstName} ${lastName}`.trim()
              } else if (data.fullName && data.fullName.trim()) {
                fullName = data.fullName.trim()
              } else if (firstName) {
                fullName = firstName.trim()
              } else if (lastName) {
                fullName = lastName.trim()
              }
            
            return {
                identity: identity,
              info: {
                firstName: firstName,
                lastName: lastName,
                fullName: fullName,
                label: data.label || 'Participant',
                role: data.role || 'unknown',
              },
            }
            } else {
              const errorText = await response.text()
              console.error(`[Client] API error for ${identity}:`, response.status, errorText)
          }
        } catch (error) {
            if (attempt < retries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
            }
          }
        }
        
        // Determine role based on sessionOwnerId if available
        const isCoach = sessionOwnerId && identity === sessionOwnerId
        return {
          identity: identity,
          info: {
            firstName: '',
            lastName: '',
            fullName: identity,
            label: isCoach ? 'Coach' : 'Participant',
            role: isCoach ? 'coach' : 'unknown',
          },
        }
      }

      const infoPromises = allParticipants
        .filter(p => p.identity && p.identity.trim() !== '')
        .map(async (p) => {
          // Skip if we already have valid info
          if (participantInfo[p.identity] && participantInfo[p.identity].fullName && participantInfo[p.identity].fullName !== 'Loading...' && participantInfo[p.identity].fullName !== p.identity) {
            return null
          }
          
          // Skip if we're already fetching this participant
          if (fetchedParticipantsRef.current.has(p.identity)) {
            const existingInfo = participantInfo[p.identity]
            if (existingInfo && existingInfo.fullName && existingInfo.fullName !== 'Loading...' && existingInfo.fullName !== p.identity) {
              return null
            }
          }
          
          // Set initial loading state
          if (!participantInfo[p.identity]) {
            setParticipantInfo(prev => ({
              ...prev,
              [p.identity]: {
                firstName: '',
                lastName: '',
                fullName: 'Loading...',
                label: sessionOwnerId && p.identity === sessionOwnerId ? 'Coach' : 'Participant',
                role: sessionOwnerId && p.identity === sessionOwnerId ? 'coach' : 'unknown',
              }
            }))
          }
          
          fetchedParticipantsRef.current.add(p.identity)
          const result = await fetchWithRetry(p.identity)
          return result
      })

      const results = await Promise.all(infoPromises)
      
        const newInfo: typeof participantInfo = { ...participantInfo }
      let hasUpdates = false
        
      results.forEach((result) => {
        if (result && result.info) {
          newInfo[result.identity] = result.info
          hasUpdates = true
        }
      })

      if (hasUpdates) {
        setParticipantInfo(newInfo)
      }
    }

      fetchParticipantInfo().catch((error) => {
        console.error('[Client] Error in fetchParticipantInfo:', error)
      })
    })
  }
  
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
  // Include ALL participants, not just remote ones
  const otherParticipants = participants.filter((p) => p.identity !== coachParticipant?.identity)
  
  // Track if we've already fetched the expected participants to avoid re-fetching
  const expectedParticipantsFetchedRef = useRef<boolean>(false)
  const expectedParticipantIdsRef = useRef<string[]>([])
  
  // Fetch expected participants from session (only once, or when sessionId changes)
  useEffect(() => {
    const fetchExpectedParticipants = async () => {
      if (!sessionId) {
        setIsLoadingExpectedParticipants(false)
        return
      }

      // Skip if we've already fetched for this session
      if (expectedParticipantsFetchedRef.current) {
        return
      }

      try {
        setIsLoadingExpectedParticipants(true)
        console.log('[Client] Fetching session data for:', sessionId)
        const response = await fetch(`/api/sessions/${sessionId}`)
        
        if (!response.ok) {
          console.error('[Client] Failed to fetch session:', response.status, response.statusText)
          const errorText = await response.text()
          console.error('[Client] Error response:', errorText)
          setIsLoadingExpectedParticipants(false)
          return
        }
        
        const data = await response.json()
        console.log('[Client] Session data received:', data)
        const sessionData = data.session
        
        if (!sessionData) {
          console.error('[Client] No session data in response')
          setIsLoadingExpectedParticipants(false)
          return
        }
        
        console.log('[Client] Session data:', {
          user_id: sessionData.user_id,
          subject_id: sessionData.subject_id,
          subject_ids: sessionData.subject_ids,
          session_id: sessionData.session_id
        })
        
        // Store subject_id for mocap sessions
        if (sessionData.subject_id) {
          setSessionSubjectId(sessionData.subject_id)
        }
        
        const expectedIds: string[] = []
        
        // Add coach/owner
        if (sessionData.user_id) {
          expectedIds.push(sessionData.user_id)
          console.log('[Client] Added coach:', sessionData.user_id)
        }
        
        // Add single participant (1:1 session)
        if (sessionData.subject_id) {
          expectedIds.push(sessionData.subject_id)
          console.log('[Client] Added subject_id:', sessionData.subject_id)
        }
        
        // Add group participants
        if (sessionData.subject_ids && Array.isArray(sessionData.subject_ids)) {
          expectedIds.push(...sessionData.subject_ids)
          console.log('[Client] Added subject_ids:', sessionData.subject_ids)
        }
        
        console.log('[Client] Total expected participants:', expectedIds)
        
        if (expectedIds.length === 0) {
          console.warn('[Client] No expected participants found in session data')
          setExpectedParticipants([])
          setIsLoadingExpectedParticipants(false)
          return
        }
        
        // Store the expected IDs
        expectedParticipantIdsRef.current = expectedIds
        
        // Fetch names for all expected participants
        const participantPromises = expectedIds.map(async (id) => {
          try {
            const url = sessionOwnerId 
              ? `/api/participants/${id}?sessionOwnerId=${encodeURIComponent(sessionOwnerId)}&sessionId=${sessionId}`
              : `/api/participants/${id}?sessionId=${sessionId}`
            console.log('[Client] Fetching participant info from:', url)
            const participantResponse = await fetch(url)
            if (participantResponse.ok) {
              const participantData = await participantResponse.json()
              console.log('[Client] Participant data for', id, ':', participantData)
              
              // Build full name from firstName and lastName
              const firstName = participantData.firstName || ''
              const lastName = participantData.lastName || ''
              let fullName = ''
              if (firstName && lastName) {
                fullName = `${firstName} ${lastName}`.trim()
              } else if (participantData.fullName && participantData.fullName.trim()) {
                fullName = participantData.fullName.trim()
              } else if (firstName) {
                fullName = firstName.trim()
              } else if (lastName) {
                fullName = lastName.trim()
              } else {
                fullName = id // Fallback to ID only if no name data
              }
              
              console.log('[Client] Built name for', id, ':', fullName)
              
              return {
                id,
                name: fullName,
                isConnected: false // Will be updated by the next useEffect
              }
            } else {
              console.error('[Client] Failed to fetch participant', id, ':', participantResponse.status)
            }
          } catch (error) {
            console.error(`[Client] Error fetching participant ${id}:`, error)
          }
          // Fallback: return ID as name only if fetch completely fails
          return {
            id,
            name: id,
            isConnected: false // Will be updated by the next useEffect
          }
        })
        
        const participantsList = await Promise.all(participantPromises)
        console.log('[Client] Final participants list:', participantsList)
        setExpectedParticipants(participantsList)
        expectedParticipantsFetchedRef.current = true
        
        // Immediately update connection status after fetching expected participants
        const allParticipantIdentities = new Set<string>()
        if (localParticipant?.identity) {
          allParticipantIdentities.add(localParticipant.identity)
        }
        remoteParticipants.forEach(p => {
          if (p.identity) {
            allParticipantIdentities.add(p.identity)
          }
        })
        participants.forEach(p => {
          if (p.identity) {
            allParticipantIdentities.add(p.identity)
          }
        })
        const identitiesArray = Array.from(allParticipantIdentities)
        
        console.log('[Client] Immediately updating connection status after fetch')
        console.log('[Client] Connected identities:', identitiesArray)
        
        const updatedList = participantsList.map(exp => ({
          ...exp,
          isConnected: identitiesArray.includes(exp.id)
        }))
        console.log('[Client] Updated list with connection status:', updatedList)
        setExpectedParticipants(updatedList)
      } catch (error) {
        console.error("[Client] Error fetching expected participants:", error)
        // Don't clear existing participants on error
      } finally {
        setIsLoadingExpectedParticipants(false)
      }
    }

    if (sessionId) {
      fetchExpectedParticipants()
    }
  }, [sessionId, sessionOwnerId])

  // Update connection status when participants change (without re-fetching)
  // Use refs to track previous values and prevent infinite loops
  const prevIdentitiesRef = useRef<Set<string>>(new Set())
  const expectedParticipantsRef = useRef<Array<{ id: string; name: string; isConnected: boolean }>>([])
  
  useEffect(() => {
    expectedParticipantsRef.current = expectedParticipants
  }, [expectedParticipants])
  
  useEffect(() => {
    console.log('[Client] Connection status useEffect triggered')
    console.log('[Client] expectedParticipantIdsRef.current:', expectedParticipantIdsRef.current)
    console.log('[Client] participants.length:', participants.length)
    console.log('[Client] remoteParticipants.length:', remoteParticipants.length)
    
    if (expectedParticipantIdsRef.current.length === 0 || expectedParticipantsRef.current.length === 0) {
      console.log('[Client] Skipping connection status update - no expected participants yet')
      return
    }
    
    // Get all participant identities including local participant
    const allParticipantIdentities = new Set<string>()
    
    if (localParticipant?.identity) {
      allParticipantIdentities.add(localParticipant.identity)
      console.log('[Client] Added local participant:', localParticipant.identity)
    }
    
    remoteParticipants.forEach(p => {
      if (p.identity) {
        allParticipantIdentities.add(p.identity)
        console.log('[Client] Added remote participant:', p.identity)
      }
    })
    
    // Also check the participants array directly (this is the most reliable source)
    participants.forEach(p => {
      if (p.identity) {
        allParticipantIdentities.add(p.identity)
        console.log('[Client] Added participant from participants array:', p.identity)
      }
    })
    
    const identitiesArray = Array.from(allParticipantIdentities)
    
    // Check if identities have actually changed
    const identitiesString = Array.from(identitiesArray).sort().join(',')
    const prevIdentitiesString = Array.from(prevIdentitiesRef.current).sort().join(',')
    
    if (identitiesString === prevIdentitiesString) {
      console.log('[Client] Identities unchanged, skipping update')
      return
    }
    
    prevIdentitiesRef.current = allParticipantIdentities
    
    console.log('[Client] Updating connection status.')
    console.log('[Client] Local participant identity:', localParticipant?.identity)
    console.log('[Client] Remote participant identities:', remoteParticipants.map(p => p.identity))
    console.log('[Client] All participants identities:', participants.map(p => p.identity))
    console.log('[Client] All connected participant identities (combined):', identitiesArray)
    console.log('[Client] Expected participant IDs:', expectedParticipantIdsRef.current)
    
    setExpectedParticipants(prev => {
      // Check if any connection status actually changed
      const hasChanges = prev.some(exp => {
        const isConnected = identitiesArray.some(id => id === exp.id || id.includes(exp.id) || exp.id.includes(id))
        return exp.isConnected !== isConnected
      })
      
      if (!hasChanges) {
        console.log('[Client] No connection status changes, skipping update')
        return prev
      }
      
      console.log('[Client] Current expected participants before update:', prev)
      const updated = prev.map(exp => {
        // Check if this expected participant ID matches any connected participant identity
        const isConnected = identitiesArray.some(id => id === exp.id || id.includes(exp.id) || exp.id.includes(id))
        console.log(`[Client] Checking ${exp.id} (${exp.name}): ${isConnected ? '✅ Connected' : '❌ Not Connected'}`)
        if (isConnected) {
          console.log(`[Client] ✅ Match found! ${exp.name} is connected`)
        } else {
          console.log(`[Client] ❌ No match. Looking for "${exp.id}" in:`, identitiesArray)
          console.log(`[Client] Comparison: "${exp.id}" === any of:`, identitiesArray.map(id => `"${id}"`))
          // Try to find a partial match (in case IDs are slightly different)
          const partialMatch = identitiesArray.find(id => 
            id.toLowerCase() === exp.id.toLowerCase() ||
            id.endsWith(exp.id) ||
            exp.id.endsWith(id)
          )
          if (partialMatch) {
            console.log(`[Client] ⚠️ Found partial match: "${exp.id}" might match "${partialMatch}"`)
          }
        }
        return {
          ...exp,
          isConnected
        }
      })
      console.log('[Client] Updated expected participants:', updated)
      return updated
    })
  }, [participants, localParticipant?.identity, remoteParticipants, room])

  // Listen for participant join/leave events to update connection status in real-time
  // This ensures immediate updates when participants connect/disconnect
  useEffect(() => {
    if (!room || expectedParticipantIdsRef.current.length === 0) return

    const updateConnectionStatus = () => {
      const allParticipantIdentities = new Set<string>()
      
      if (room.localParticipant?.identity) {
        allParticipantIdentities.add(room.localParticipant.identity)
      }
      
      room.remoteParticipants.forEach(p => {
        if (p.identity) {
          allParticipantIdentities.add(p.identity)
        }
      })
      
      const identitiesArray = Array.from(allParticipantIdentities)
      
      console.log('[Client] 🎯 Real-time connection update - connected identities:', identitiesArray)
      
      setExpectedParticipants(prev => {
        const updated = prev.map(exp => {
          const isConnected = identitiesArray.includes(exp.id)
          if (isConnected !== exp.isConnected) {
            console.log(`[Client] 🔄 Connection status changed for ${exp.name}: ${exp.isConnected ? '❌' : '✅'} → ${isConnected ? '✅' : '❌'}`)
          }
          return {
            ...exp,
            isConnected
          }
        })
        return updated
      })
    }

    // Listen for participant events
    room.on('participantConnected', (participant) => {
      console.log('[Client] 🎉 Participant connected event:', participant.identity)
      updateConnectionStatus()
    })
    
    room.on('participantDisconnected', (participant) => {
      console.log('[Client] 👋 Participant disconnected event:', participant.identity)
      updateConnectionStatus()
    })

    // Initial update
    updateConnectionStatus()

    return () => {
      room.off('participantConnected', updateConnectionStatus)
      room.off('participantDisconnected', updateConnectionStatus)
    }
  }, [room, expectedParticipantIdsRef.current.length])
  
  // Helper to get track for a participant
  const getTrackForParticipant = (participantIdentity: string) => {
    return tracks.find(
      (track) => track.participant.identity === participantIdentity && track.source === Track.Source.Camera
    )
  }

  // Helper to format participant name with role
  const formatParticipantName = (info: typeof participantInfo[string] | undefined, participant: typeof participants[0]) => {
    // Check if this participant is the coach based on sessionOwnerId
    const isCoach = sessionOwnerId && participant.identity === sessionOwnerId
    
    // If we have info from the API, use it
    if (info) {
      // Build name from firstName and lastName (from jak-users f_name/l_name or jak-subjects f_name/l_name)
      const firstName = info.firstName || ''
      const lastName = info.lastName || ''
      
      // Construct full name from firstName and lastName
      let fullName = ''
      if (firstName && lastName) {
        fullName = `${firstName} ${lastName}`.trim()
      } else if (info.fullName && info.fullName.trim() && !info.fullName.includes('@')) {
        // Use fullName from API if it's not an email
        fullName = info.fullName.trim()
      } else if (firstName) {
        fullName = firstName.trim()
      } else if (lastName) {
        fullName = lastName.trim()
      } else if (info.fullName && info.fullName.trim()) {
        // Use fullName even if it might be an email, as long as it's not empty
        fullName = info.fullName.trim()
      }

      // Return formatted name if we have any name data
      if (fullName && fullName.trim()) {
        // Determine role label - prefer API role, but fallback to sessionOwnerId check
        const role = info.role === 'coach' || isCoach ? 'Coach' : 'Participant'
        return `${fullName} (${role})`
      }
    }

    // Fallback: if we know it's a coach but don't have name yet, show "Coach" label
    if (isCoach) {
      return `${participant.identity} (Coach)`
    }

    // Fallback: show participant identity with Participant label
    return `${participant.identity || 'Unknown'} (Participant)`
  }

  // Fetch metrics for participants
  useEffect(() => {
    if (!sessionId) return

    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/ai-insights/metrics/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          const metrics: Record<string, { balance: number; symmetry: number; postural: number }> = {}
          
          // Get latest metric per participant
          const participantMap = new Map<string, any>()
          data.metrics?.forEach((metric: any) => {
            const pid = metric.participant_id || metric.subject_id
            if (pid && (!participantMap.has(pid) || new Date(metric.timestamp) > new Date(participantMap.get(pid).timestamp))) {
              participantMap.set(pid, metric)
            }
          })
          
          participantMap.forEach((metric, pid) => {
            metrics[pid] = {
              balance: metric.balance_score || 0,
              symmetry: metric.symmetry_score || 0,
              postural: metric.postural_efficiency || 0
            }
          })
          
          setParticipantMetrics(metrics)
        }
      } catch (error) {
        console.error('[Video Session] Error fetching metrics:', error)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 2000) // Update every 2 seconds
    return () => clearInterval(interval)
  }, [sessionId])

  // Helper to render a participant video tile
  const renderParticipantTile = (participant: typeof participants[0], isLarge: boolean = false) => {
    const trackRef = getTrackForParticipant(participant.identity)
    const info = participantInfo[participant.identity]
    const displayName = formatParticipantName(info, participant)
    const metrics = participantMetrics[participant.identity]
    
    // Get first letter for avatar
    const firstName = info?.firstName || ''
    const lastName = info?.lastName || ''
    const firstLetter = firstName 
      ? firstName.charAt(0).toUpperCase()
      : (info?.fullName || participant.name || participant.identity).charAt(0).toUpperCase()

    if (isLarge) {
      // Large boxes: name overlay on video (existing behavior)
      return (
        <div
          key={participant.identity}
          className="relative bg-slate-800 rounded-xl overflow-hidden w-full h-full shadow-lg"
        >
          {trackRef ? (
            <TrackRefContext.Provider value={trackRef}>
              <VideoTrack trackRef={trackRef} className="w-full h-full rounded-xl" />
            </TrackRefContext.Provider>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-2xl font-medium text-white">
                  {firstLetter}
                </span>
              </div>
            </div>
          )}
          {/* Metrics overlay - top right */}
          {metrics && (metrics.balance > 0 || metrics.symmetry > 0 || metrics.postural > 0) && (
            <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/70">Balance</span>
                  <span className="text-xs font-bold text-white">{Math.round(metrics.balance)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/70">Symmetry</span>
                  <span className="text-xs font-bold text-white">{Math.round(metrics.symmetry)}%</span>
                </div>
              </div>
            </div>
          )}
          {/* Name overlay next to mute icon */}
          <div className="lk-participant-name-overlay">
            <p>{displayName}</p>
          </div>
          
        </div>
      )
    } else {
      // Rectangular boxes: video fills available space, name overlay at bottom
      return (
        <div
          key={participant.identity}
          className="relative bg-slate-800 rounded-xl overflow-hidden w-full h-full shadow-lg"
          style={{ width: '100%', height: '100%', minWidth: 0, maxWidth: '100%' }}
        >
          {/* Video section - fills available space */}
          <div className="relative w-full h-full">
            {trackRef ? (
              <TrackRefContext.Provider value={trackRef}>
                <VideoTrack trackRef={trackRef} className="w-full h-full rounded-xl" style={{ width: '100%', height: '100%' }} />
              </TrackRefContext.Provider>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-700/50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-medium text-white">
                    {firstLetter}
                  </span>
                </div>
              </div>
            )}
            {/* Metrics overlay - top right */}
            {metrics && (metrics.balance > 0 || metrics.symmetry > 0 || metrics.postural > 0) && (
              <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-white/20 z-10">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-white/70">Balance</span>
                    <span className="text-[10px] font-bold text-white">{Math.round(metrics.balance)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-white/70">Symmetry</span>
                    <span className="text-[10px] font-bold text-white">{Math.round(metrics.symmetry)}%</span>
                  </div>
                </div>
              </div>
            )}
            {/* Name overlay next to mute icon */}
            <div className="lk-participant-name-overlay">
              <p>{displayName}</p>
            </div>
            
          </div>
        </div>
      )
    }
  }


  // Render layout based on layoutMode
  const renderLayout = () => {
    switch (layoutMode) {
      case 'grid':
        // Grid layout: all participants in a responsive grid
        // If only one participant, show them full screen
        const participantCount = participants.length
        
        if (participantCount === 1 && participants[0]) {
          return (
            <div className="h-full w-full">
              {renderParticipantTile(participants[0], true)}
            </div>
          )
        }
        
        // Manual grid with equal-sized tiles - use CSS grid for proper layout
        // Calculate grid columns based on participant count (for desktop)
        let gridCols = 2 // Default: 2 columns
        if (participantCount === 1) {
          gridCols = 1
        } else if (participantCount === 2) {
          gridCols = 2 // 2 participants: side by side
        } else if (participantCount <= 4) {
          gridCols = 2 // 3-4 participants: 2x2 grid
        } else if (participantCount <= 6) {
          gridCols = 3 // 5-6 participants: 3 columns
        } else if (participantCount <= 9) {
          gridCols = 3 // 7-9 participants: 3x3 grid
        } else {
          gridCols = 4 // 10+ participants: 4 columns
        }
        
        // On mobile: stack vertically (1 column), on desktop: use calculated grid
        return (
          <>
            <style dangerouslySetInnerHTML={{
              __html: `
                .grid-layout-mobile-stack {
                  display: grid;
                  grid-template-columns: repeat(1, 1fr);
                  gap: 0.5rem;
                  place-items: center;
                  justify-content: center;
                }
                @media (min-width: 768px) {
                  .grid-layout-mobile-stack {
                    grid-template-columns: repeat(${gridCols}, minmax(0, 1fr)) !important;
                    place-items: center;
                    justify-content: center;
                  }
                }
              `
            }} />
            <div 
              className="h-full w-full p-2 md:p-4 overflow-y-auto grid-layout-mobile-stack"
            >
            {participants.map((participant) => (
                <div 
                  key={participant.identity} 
                  className="w-full max-w-full"
                  style={{
                    aspectRatio: '16/9',
                    minWidth: 0,
                    maxWidth: '100%',
                  }}
                >
                  {renderParticipantTile(participant, false)}
              </div>
            ))}
          </div>
          </>
        )

      case 'spotlight':
        // Spotlight layout: use LiveKit's FocusLayoutContainer with CarouselLayout and FocusLayout
        // Based on: https://github.com/livekit/components-js/blob/main/packages/react/src/prefabs/VideoConference.tsx
        // For 1:1 sessions: Participant in big box, Coach in small box
        // For group sessions: Priority: 1. Manually selected, 2. Other participants, 3. Coach
        let spotlightParticipant: typeof participants[0] | undefined
        
        // For 1:1 sessions (single), prioritize participant over coach
        if (sessionType === 'single') {
          // First priority: manually selected participant
          if (spotlightParticipantId) {
            spotlightParticipant = participants.find((p) => p.identity === spotlightParticipantId)
          }
          
          // Second priority: participant (not coach) - this is the main change for 1:1
          if (!spotlightParticipant && otherParticipants.length > 0) {
            spotlightParticipant = otherParticipants[0]
          }
          
          // Third priority: coach as fallback
          if (!spotlightParticipant) {
            spotlightParticipant = coachParticipant
          }
        } else {
          // For group sessions, keep original behavior
          // First priority: current logged-in user (local participant)
          if (localParticipant?.identity) {
            spotlightParticipant = participants.find((p) => p.identity === localParticipant.identity)
          }
          
          // Second priority: manually selected participant
          if (!spotlightParticipant && spotlightParticipantId) {
            spotlightParticipant = participants.find((p) => p.identity === spotlightParticipantId)
          }
          
          // Third priority: other participants or coach
          if (!spotlightParticipant) {
            spotlightParticipant = otherParticipants[0] || coachParticipant
          }
        }

        if (!spotlightParticipant) {
          return <div className="h-full w-full flex items-center justify-center text-white">No participants</div>
        }

        // Get track references for all participants
        const spotlightTrackRef = getTrackForParticipant(spotlightParticipant.identity)
        const totalParticipantsSpotlight = participants.length
        const otherParticipantsList = participants.filter((p) => p.identity !== spotlightParticipant.identity)
        
        // Get track references for carousel participants, creating placeholders for those without tracks
        const carouselTracks = otherParticipantsList.map((p) => {
          const trackRef = getTrackForParticipant(p.identity)
          // If no track reference found, create a placeholder
          if (!trackRef) {
            return {
              participant: p,
              source: Track.Source.Camera,
            } as { participant: typeof p; source: Track.Source }
          }
          return trackRef
        }).filter((track): track is NonNullable<typeof track> => track !== undefined)
        
        // If only one participant, show them full screen
        if (totalParticipantsSpotlight === 1) {
        return (
            <div className="h-full w-full">
              {spotlightTrackRef ? (
                <FocusLayout trackRef={spotlightTrackRef} className="h-full w-full" />
              ) : (
                renderParticipantTile(spotlightParticipant, true)
              )}
            </div>
          )
        }
        
        // Use FocusLayoutContainer with CarouselLayout and FocusLayout
        return (
          <>
            <style dangerouslySetInnerHTML={{
              __html: `
                /* Hide default LiveKit participant names in focus layout */
                .lk-focus-layout .lk-participant-name {
                  display: none !important;
                }
                /* Position participant name next to mute icon */
                .lk-participant-tile {
                  position: relative;
                }
                /* Custom name overlay next to mute icon */
                .lk-participant-name-overlay {
                  position: absolute;
                  top: 0.5rem;
                  left: 2.5rem;
                  background-color: rgba(0, 0, 0, 0.7);
                  backdrop-filter: blur(8px);
                  padding: 0.375rem 0.75rem;
                  border-radius: 0.375rem;
                  z-index: 10;
                  pointer-events: none;
                }
                .lk-participant-name-overlay p {
                  font-size: 0.75rem;
                  font-weight: 600;
                  color: white;
                  margin: 0;
                  white-space: nowrap;
                }
              `
            }} />
            <FocusLayoutContainer className="h-full w-full">
              {/* CarouselLayout for side participants - comes first in DOM */}
              {carouselTracks.length > 0 && (
                <CarouselLayout tracks={carouselTracks}>
                  <TrackRefContext.Consumer>
                    {(trackRef) => {
                      if (!trackRef) return <ParticipantTile />
                      const participant = trackRef.participant
                      const info = participantInfo[participant.identity]
                      // Find the participant in the participants array to get the correct type
                      const participantFromList = participants.find(p => p.identity === participant.identity)
                      const displayName = formatParticipantName(info, participantFromList || participants[0])
                      
                      return (
                        <div className="relative h-full w-full">
                          <ParticipantTile trackRef={trackRef} />
                          {/* Custom name overlay next to mute icon */}
                          <div className="lk-participant-name-overlay">
                            <p>{displayName}</p>
                          </div>
                        </div>
                      )
                    }}
                  </TrackRefContext.Consumer>
                </CarouselLayout>
              )}
              {/* FocusLayout for main participant - comes second in DOM */}
              {spotlightTrackRef ? (
                <div className="relative h-full w-full">
                  <FocusLayout trackRef={spotlightTrackRef} />
                  {/* Custom name overlay for main participant - next to mute icon */}
                  {(() => {
                    const info = participantInfo[spotlightParticipant.identity]
                    const displayName = formatParticipantName(info, spotlightParticipant)
                    return (
                      <>
                        <div className="lk-participant-name-overlay">
                          <p>{displayName}</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : (
                // Fallback if no track available
                <div className="h-full w-full">
                  {renderParticipantTile(spotlightParticipant, true)}
                </div>
              )}
            </FocusLayoutContainer>
          </>
        )

      case 'one-on-one':
        // 1:1 layout: athlete/member big (left), coach small (right) - swapped from default
        // If only one participant total, don't show small box (no duplicates)
        const athleteParticipant = otherParticipants[0] || localParticipant
        const totalParticipantsOneOnOne = participants.length
        return (
          <div className="h-full w-full flex flex-col md:flex-row">
            {/* Athlete/Member - large */}
            {athleteParticipant && (
              <div className="flex-1 min-w-0 h-full">
                {renderParticipantTile(athleteParticipant, true)}
              </div>
            )}
            {/* Coach - small (only if more than 1 participant total) */}
            {coachParticipant && totalParticipantsOneOnOne > 1 && (
              <div className="md:w-40 md:flex-col md:gap-2 md:p-2 flex flex-row gap-2 p-2 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden">
                {[coachParticipant].map((participant) => renderParticipantTile(participant, false))}
              </div>
            )}
          </div>
        )

      case 'default':
      default:
        // Default mode removed - redirect to grid layout
        // This handles any edge cases where default mode might still be set
        const participantCountDefault = participants.length
        
        if (participantCountDefault === 1 && participants[0]) {
          return (
            <div className="h-full w-full">
              {renderParticipantTile(participants[0], true)}
            </div>
          )
        }
        
        // Use grid layout as fallback
        let gridColsDefault = 2
        if (participantCountDefault === 2) {
          gridColsDefault = 2
        } else if (participantCountDefault <= 4) {
          gridColsDefault = 2
        } else if (participantCountDefault <= 6) {
          gridColsDefault = 3
        } else if (participantCountDefault <= 9) {
          gridColsDefault = 3
        } else {
          gridColsDefault = 4
        }
        
          return (
          <>
            <style dangerouslySetInnerHTML={{
              __html: `
                .grid-layout-mobile-stack-default {
                  display: grid;
                  grid-template-columns: repeat(1, 1fr);
                  gap: 0.5rem;
                  place-items: center;
                  justify-content: center;
                }
                @media (min-width: 768px) {
                  .grid-layout-mobile-stack-default {
                    grid-template-columns: repeat(${gridColsDefault}, minmax(0, 1fr)) !important;
                    place-items: center;
                    justify-content: center;
                  }
                }
              `
            }} />
            <div 
              className="h-full w-full p-2 md:p-4 overflow-y-auto grid-layout-mobile-stack-default"
            >
              {participants.map((participant) => (
                <div 
                  key={participant.identity} 
                  className="w-full max-w-full"
                  style={{
                    aspectRatio: '16/9',
                    minWidth: 0,
                    maxWidth: '100%',
                  }}
                >
                  {renderParticipantTile(participant, false)}
                </div>
              ))}
                </div>
          </>
          )
    }
  }

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      <div
        className="relative h-full flex flex-col transition-all duration-300 ease-in-out"
        style={{
          width: isPanelOpen ? `${100 - panelWidth}%` : '100%',
          flex: isPanelOpen ? '0 0 auto' : '1 1 auto'
        }}
      >
        {/* Main video area - Dynamic layout based on layoutMode */}
        <div className="h-full min-h-0 relative overflow-hidden bg-[#0a0a0a] flex items-center justify-center" style={{ display: 'flex', flexDirection: 'column' }}>
          {renderLayout()}
        </div>

        {/* Layout Controls - Show for all participants */}
        <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-full z-40 bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
            {sessionType === 'group' ? (
              <>
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    layoutMode === 'grid' 
                      ? 'bg-white text-black' 
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                  title="Grid Layout"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setLayoutMode('spotlight')
                    if (!spotlightParticipantId && otherParticipants.length > 0) {
                      setSpotlightParticipantId(otherParticipants[0].identity)
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    layoutMode === 'spotlight' 
                      ? 'bg-white text-black' 
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                  title="Spotlight Layout"
                >
                  <User className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    layoutMode === 'grid' 
                      ? 'bg-white text-black' 
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                  title="Grid Layout"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setLayoutMode('spotlight')
                    if (!spotlightParticipantId && otherParticipants.length > 0) {
                      setSpotlightParticipantId(otherParticipants[0].identity)
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    layoutMode === 'spotlight' 
                      ? 'bg-white text-black' 
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                  title="Spotlight Layout"
                >
                  <User className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

        {/* Standard LiveKit ControlBar */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Make ControlBar icons visible - light color on dark background */
            .lk-control-bar button {
              color: white !important;
              background: transparent !important;
            }
            .lk-control-bar button svg {
              color: white !important;
              fill: white !important;
              stroke: white !important;
            }
            .lk-control-bar button:hover {
              background-color: rgba(255, 255, 255, 0.1) !important;
            }
            /* Style leave button to match other icons (not red) */
            .lk-control-bar button.lk-button-leave,
            .lk-control-bar button[data-lk-leave],
            .lk-control-bar [data-lk-leave] {
              background-color: transparent !important;
              color: white !important;
            }
            .lk-control-bar button.lk-button-leave:hover,
            .lk-control-bar button[data-lk-leave]:hover,
            .lk-control-bar [data-lk-leave]:hover {
              background-color: rgba(255, 255, 255, 0.1) !important;
            }
            .lk-control-bar {
              background-color: rgba(0, 0, 0, 0.7) !important;
              backdrop-filter: blur(10px);
              border-radius: 9999px;
              padding: 0.75rem 1rem;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
          `
        }} />
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-50"
          style={{ 
            bottom: 'calc(3vh + env(safe-area-inset-bottom, 0))'
          }}
        >
          <ControlBar 
            controls={{
              microphone: true,
              camera: true,
              screenShare: false, // Remove screen share
              leave: true, // Enable leave button inside ControlBar
              chat: false,
              settings: false,
            }}
            variation="minimal"
          />
        </div>

        {/* Session info - Clean, minimal badges */}
        <div className="absolute top-4 md:top-6 right-4 md:right-6 bg-black/30 backdrop-blur-sm px-3 md:px-4 py-2 md:py-2.5 rounded-xl z-10 border border-white/10">
          <p className="text-[7px] md:text-[8px] text-white/60 uppercase tracking-wider mb-0.5">Session Duration</p>
          <p className="text-[9px] md:text-[11px] font-mono font-semibold text-white mb-1">{sessionDuration}</p>
          {/* Connected status - smaller, inside Session Duration box */}
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-white/10">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
            <span className="text-[8px] md:text-[10px] font-medium text-white/80">Connected</span>
          </div>
        </div>
      </div>

      <Button
        variant="secondary"
        size="icon"
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 h-16 w-12 rounded-2xl shadow-lg z-20 transition-all duration-300"
        style={{
          right: isPanelOpen ? `${panelWidth}%` : '1rem',
          transform: isPanelOpen ? 'translateX(50%) translateY(-50%)' : 'translateY(-50%)'
        }}
        onClick={() => {
          if (isPanelOpen) {
            setPanelWidth(0)
            setIsPanelOpen(false)
          } else {
            setPanelWidth(40)
            setIsPanelOpen(true)
          }
        }}
      >
        {isPanelOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>

      <div
        className="hidden md:flex h-full border-l bg-background flex-col transition-all duration-300 ease-in-out overflow-hidden relative"
        style={{
          width: isPanelOpen ? `${panelWidth}%` : '0',
          minWidth: isPanelOpen ? '0' : '0',
          borderLeftWidth: isPanelOpen ? '1px' : '0'
        }}
      >
        {/* Resize handle */}
        {isPanelOpen && (
          <div
            className="absolute left-0 top-0 bottom-0 w-2 bg-transparent hover:bg-primary/30 cursor-col-resize z-30 transition-colors group"
            onMouseDown={handleMouseDown}
            style={{
              cursor: 'col-resize'
            }}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-16 bg-primary/0 group-hover:bg-primary/60 rounded-full transition-colors" />
          </div>
        )}
        <Tabs defaultValue="participants" className="flex-1 flex flex-col h-full">
          <div className="border-b">
            <TabsList className="w-full rounded-none border-0">
              {v2Enabled && (
                <TabsTrigger value="metrics" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold">
                  Live Metrics
                </TabsTrigger>
              )}
              <TabsTrigger value="participants" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold">
                Participants
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold">
                AI Coach Chat
              </TabsTrigger>
              <TabsTrigger value="pose-metrics" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold">
                Live Metrics
              </TabsTrigger>
              <TabsTrigger value="live-metrics" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold">
                Baseball Metrics
              </TabsTrigger>
              {/* Only show Insights tab to coaches */}
              {localParticipant?.identity === sessionOwnerId && (
                <TabsTrigger value="insights" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold">
                  Baseball Insights
                </TabsTrigger>
              )}
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
            value="participants"
            className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide mt-0 h-[calc(100vh-120px)] flex flex-col"
          >
            {/* Session Name */}
            {sessionTitle && (
              <div className="mb-4">
                <h2 className="font-semibold text-base">{sessionTitle}</h2>
              </div>
            )}
            
            <h3 className="font-semibold text-sm">Participants</h3>
            
            {isLoadingExpectedParticipants ? (
              <div className="text-sm text-muted-foreground">Loading participants...</div>
            ) : expectedParticipants.length > 0 ? (
              <div className="space-y-3">
                {expectedParticipants.map((expected) => {
                  // Find the connected participant if they're in the session
                  const connectedParticipant = participants.find(p => p.identity === expected.id)
                  const info = participantInfo[expected.id]
                  
                  // Check if this participant is the coach
                  const isCoach = sessionOwnerId && expected.id === sessionOwnerId
                  
                  // Use name from expected participants list (already fetched), or from participantInfo, or fallback
                  let displayName = expected.name
                  if (info?.fullName) {
                    displayName = info.fullName
                  } else if (info?.firstName && info?.lastName) {
                    displayName = `${info.firstName} ${info.lastName}`.trim()
                  } else if (expected.name && expected.name !== expected.id) {
                    displayName = expected.name
                  } else {
                    displayName = expected.id // Last resort
                  }
                  
                  const firstName = info?.firstName || expected.name.split(' ')[0] || ''
                const firstLetter = firstName 
                  ? firstName.charAt(0).toUpperCase()
                    : (displayName && displayName !== expected.id ? displayName.charAt(0).toUpperCase() : expected.id.charAt(0).toUpperCase())
                
                return (
                    <Card key={expected.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {firstLetter}
                        </span>
                      </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{displayName}</span>
                            {isCoach && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium">
                                Coach
                              </span>
                            )}
                            {expected.isConnected ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                                Connected
                              </span>
                            ) : (
                              // Only show "Not Joined" for remote sessions (single/group), not for mocap
                              sessionType !== "mocap" && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-600 dark:text-gray-400">
                                  Not Joined
                                </span>
                              )
                            )}
                    </div>
                        </div>
                </div>
              </Card>
                )
              })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No participants found</div>
            )}

            {/* End Session Button - Only visible to coach */}
            {isCoach && sessionId && (
              <div className="pt-4 mt-auto border-t border-border flex-shrink-0">
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  size="lg"
                  onClick={async () => {
                    if (!sessionId) return
                    
                    if (!confirm('Are you sure you want to end this session? Once ended, no one will be able to join.')) {
                      return
                    }

                    setIsEndingSession(true)
                    try {
                      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/end`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      })

                      if (response.ok) {
                        const contentType = response.headers.get('content-type')
                        if (contentType && contentType.includes('application/json')) {
                          const data = await response.json()
                          alert(data.message || 'Session ended successfully. The session is now closed.')
                        } else {
                          alert('Session ended successfully. The session is now closed.')
                        }
                        // Redirect to schedule page
                        window.location.href = '/'
                      } else {
                        // Check if response is JSON before parsing
                        const contentType = response.headers.get('content-type')
                        let errorMessage = 'Failed to end session'
                        
                        if (contentType && contentType.includes('application/json')) {
                          try {
                            const errorData = await response.json()
                            errorMessage = errorData.error || errorMessage
                          } catch (parseError) {
                            console.error('Error parsing error response:', parseError)
                            errorMessage = `Failed to end session (${response.status} ${response.statusText})`
                          }
                        } else {
                          // Response is HTML (error page)
                          const text = await response.text()
                          console.error('Non-JSON error response:', text.substring(0, 200))
                          errorMessage = `Failed to end session (${response.status} ${response.statusText})`
                        }
                        
                        alert(errorMessage)
                      }
                    } catch (error: any) {
                      console.error('Error ending session:', error)
                      alert(error.message || 'Failed to end session. Please try again.')
                    } finally {
                      setIsEndingSession(false)
                    }
                  }}
                  disabled={isEndingSession}
                >
                  {isEndingSession ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Ending Session...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5" />
                      End Session
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent
            value="chat"
            className="flex-1 overflow-hidden mt-0 p-0 h-full"
          >
            <BaseballChatPanel
              sessionId={sessionId}
              sessionOwnerId={sessionOwnerId}
              participantInfo={participantInfo}
              localParticipantId={localParticipant?.identity}
            />
          </TabsContent>

          {/* Live Metrics Tab (YOLOv8/ONNX) */}
          <TabsContent
            value="pose-metrics"
            className="flex-1 overflow-hidden mt-0 p-0 h-full"
          >
            <LiveMetricsTab
              participants={participants.map(p => ({
                identity: p.identity,
                name: participantInfo[p.identity]?.fullName || p.name || p.identity
              }))}
              participantInfo={participantInfo}
              sessionType={sessionType}
              subjectId={sessionType === 'mocap' ? sessionSubjectId : null}
            />
          </TabsContent>

          {/* Live Metrics Tab */}
          <TabsContent
            value="live-metrics"
            className="flex-1 overflow-hidden mt-0 p-0 h-full"
          >
            <BaseballMetricsTab
              participants={participants.map(p => ({
                identity: p.identity,
                name: participantInfo[p.identity]?.fullName || p.name || p.identity
              }))}
              participantInfo={participantInfo}
              sessionType={sessionType}
              subjectId={sessionType === 'mocap' ? sessionSubjectId : null}
            />
          </TabsContent>

          {/* Always render AIInsightsPanel in background for pose detection (must run for all users)
              But only show the Insights tab content to coaches */}
          <div style={{ display: 'none' }}>
            <AIInsightsPanel
              participants={participants.map(p => ({
                identity: p.identity,
                name: participantInfo[p.identity]?.fullName || p.name || p.identity
              }))}
              participantInfo={participantInfo}
              sessionOwnerId={sessionOwnerId}
              sessionId={sessionId}
              sessionType={sessionType}
            />
          </div>
          
          {/* Show Insights tab content only to coaches */}
          {localParticipant?.identity === sessionOwnerId && (
            <TabsContent
              value="insights"
              className="flex-1 overflow-hidden mt-0 p-0 h-full"
            >
              <BaseballInsightsPanel
                participants={participants.map(p => ({
                  identity: p.identity,
                  name: participantInfo[p.identity]?.fullName || p.name || p.identity
                }))}
                participantInfo={participantInfo}
                sessionType={sessionType}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

