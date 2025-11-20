"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, ChevronLeft, ChevronRight, Phone, Grid3x3, Users, User, LayoutGrid } from "lucide-react"
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
        sessionType={sessionType}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
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
  sessionType,
  sessionId,
  sessionTitle,
}: {
  isPanelOpen: boolean
  setIsPanelOpen: (open: boolean) => void
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
  // Layout state management
  // Initialize layout based on session type:
  // - 1:1 sessions start with 'one-on-one' (athlete big, coach small)
  // - Group sessions start with 'grid' (all participants in grid)
  // - Otherwise default (coach-focused)
  const getInitialLayout = (): LayoutMode => {
    if (sessionType === 'single') return 'one-on-one'
    if (sessionType === 'group') return 'grid'
    return 'default'
  }
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (sessionType === 'single') return 'one-on-one'
    if (sessionType === 'group') return 'grid'
    return 'default'
  })
  const [spotlightParticipantId, setSpotlightParticipantId] = useState<string | null>(null)
  const { data: session } = useSession()
  
  // Update layout when session type changes
  useEffect(() => {
    if (sessionType === 'single') {
      setLayoutMode('one-on-one')
    } else if (sessionType === 'group') {
      setLayoutMode('grid')
    } else {
      setLayoutMode('default')
    }
  }, [sessionType])
  const [isCoach, setIsCoach] = useState<boolean | null>(null)
  const [participantInfo, setParticipantInfo] = useState<Record<string, { firstName: string; lastName: string; fullName: string; label: string; role: string }>>({})
  const fetchedParticipantsRef = useRef<Set<string>>(new Set())
  const [expectedParticipants, setExpectedParticipants] = useState<Array<{ id: string; name: string; isConnected: boolean }>>([])
  const [isLoadingExpectedParticipants, setIsLoadingExpectedParticipants] = useState(true)
  const room = useRoomContext()
  const localParticipant = room.localParticipant
  const remoteParticipants = Array.from(room.remoteParticipants.values())
  
  // Get all video tracks
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  })

  // Track mic and camera states reactively
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(true)

  useEffect(() => {
    const updateTrackStates = () => {
      const micPublications = Array.from(localParticipant.audioTrackPublications.values())
      const cameraPublications = Array.from(localParticipant.videoTrackPublications.values())
      const micPublication = micPublications.find(pub => pub.source === Track.Source.Microphone)
      const cameraPublication = cameraPublications.find(pub => pub.source === Track.Source.Camera)
      
      setIsMicMuted(micPublication ? micPublication.isMuted : true)
      setIsCameraOff(!cameraPublication || !cameraPublication.isSubscribed || cameraPublication.isMuted)
    }

    updateTrackStates()

    // Listen for track publication changes
    const handleTrackPublished = () => updateTrackStates()
    const handleTrackUnpublished = () => updateTrackStates()
    const handleTrackMuted = () => updateTrackStates()
    const handleTrackUnmuted = () => updateTrackStates()

    localParticipant.on('trackPublished', handleTrackPublished)
    localParticipant.on('trackUnpublished', handleTrackUnpublished)
    localParticipant.on('trackMuted', handleTrackMuted)
    localParticipant.on('trackUnmuted', handleTrackUnmuted)

    return () => {
      localParticipant.off('trackPublished', handleTrackPublished)
      localParticipant.off('trackUnpublished', handleTrackUnpublished)
      localParticipant.off('trackMuted', handleTrackMuted)
      localParticipant.off('trackUnmuted', handleTrackUnmuted)
    }
  }, [localParticipant])

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
        
        return {
          identity: identity,
          info: {
            firstName: '',
            lastName: '',
            fullName: identity,
            label: 'Participant',
            role: 'unknown',
          },
        }
      }

      const infoPromises = allParticipants
        .filter(p => p.identity && p.identity.trim() !== '')
        .map(async (p) => {
          if (participantInfo[p.identity] && participantInfo[p.identity].fullName && participantInfo[p.identity].fullName !== 'Loading...') {
        return null
          }
          
          if (fetchedParticipantsRef.current.has(p.identity)) {
            const existingInfo = participantInfo[p.identity]
            if (existingInfo && existingInfo.fullName && existingInfo.fullName !== 'Loading...') {
              return null
            }
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
  useEffect(() => {
    console.log('[Client] Connection status useEffect triggered')
    console.log('[Client] expectedParticipantIdsRef.current:', expectedParticipantIdsRef.current)
    console.log('[Client] participants.length:', participants.length)
    
    if (expectedParticipantIdsRef.current.length > 0) {
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
      
      // Also check the participants array directly
      participants.forEach(p => {
        if (p.identity) {
          allParticipantIdentities.add(p.identity)
        }
      })
      
      const identitiesArray = Array.from(allParticipantIdentities)
      
      console.log('[Client] Updating connection status.')
      console.log('[Client] Local participant identity:', localParticipant?.identity)
      console.log('[Client] Remote participant identities:', remoteParticipants.map(p => p.identity))
      console.log('[Client] All participants identities:', participants.map(p => p.identity))
      console.log('[Client] All connected participant identities (combined):', identitiesArray)
      console.log('[Client] Expected participant IDs:', expectedParticipantIdsRef.current)
      
      setExpectedParticipants(prev => {
        console.log('[Client] Current expected participants before update:', prev)
        const updated = prev.map(exp => {
          const isConnected = identitiesArray.includes(exp.id)
          console.log(`[Client] Checking ${exp.id} (${exp.name}): ${isConnected ? '✅ Connected' : '❌ Not Connected'}`)
          if (isConnected) {
            console.log(`[Client] ✅ Match found! ${exp.name} is connected`)
          } else {
            console.log(`[Client] ❌ No match. Looking for "${exp.id}" in:`, identitiesArray)
            console.log(`[Client] Comparison: "${exp.id}" === any of:`, identitiesArray.map(id => `"${id}"`))
          }
          return {
            ...exp,
            isConnected
          }
        })
        console.log('[Client] Updated expected participants:', updated)
        return updated
      })
    } else {
      console.log('[Client] Skipping connection status update - no expected participants yet')
    }
  }, [participants.length, localParticipant?.identity, remoteParticipants.length])
  
  // Helper to get track for a participant
  const getTrackForParticipant = (participantIdentity: string) => {
    return tracks.find(
      (track) => track.participant.identity === participantIdentity && track.source === Track.Source.Camera
    )
  }

  // Helper to format participant name with role
  const formatParticipantName = (info: typeof participantInfo[string] | undefined, participant: typeof participants[0]) => {
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
        // Determine role label
        const role = info.role === 'coach' ? 'Coach' : 'Participant'
        return `${fullName} (${role})`
      }
    }

    // Fallback: show participant identity instead of "Loading..." forever
    // This ensures we always show something useful
    return participant.identity || 'Participant'
  }

  // Helper to render a participant video tile
  const renderParticipantTile = (participant: typeof participants[0], isLarge: boolean = false) => {
    const trackRef = getTrackForParticipant(participant.identity)
    const info = participantInfo[participant.identity]
    const displayName = formatParticipantName(info, participant)
    
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
          className="relative bg-black rounded-lg overflow-hidden w-full h-full"
        >
          {trackRef ? (
            <TrackRefContext.Provider value={trackRef}>
              <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
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
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs md:text-sm">
            <p className="font-medium text-white">{displayName}</p>
          </div>
        </div>
      )
    } else {
      // Small boxes: card structure with video on top, name below
      return (
        <div
          key={participant.identity}
          className="flex flex-col bg-black rounded-lg overflow-hidden"
        >
          {/* Video section */}
          <div className="relative aspect-video w-full">
            {trackRef ? (
              <TrackRefContext.Provider value={trackRef}>
                <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
              </TrackRefContext.Provider>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-lg font-medium text-white">
                    {firstLetter}
                  </span>
                </div>
              </div>
            )}
          </div>
          {/* Name section */}
          <div className="bg-black/90 px-2 py-1.5">
            <p className="font-medium text-white text-xs md:text-sm text-center truncate">{displayName}</p>
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
        
        // Calculate grid columns based on participant count
        let gridColsClass = 'grid-cols-2' // Default for 2 participants (side by side)
        let useFullHeight = false
        
        if (participantCount === 2) {
          gridColsClass = 'grid-cols-2' // Side by side - full height
          useFullHeight = true
        } else if (participantCount <= 4) {
          gridColsClass = 'grid-cols-2' // 2x2 grid
        } else if (participantCount <= 9) {
          gridColsClass = 'grid-cols-3' // 3x3 grid
        } else if (participantCount <= 16) {
          gridColsClass = 'grid-cols-4' // 4x4 grid
        } else {
          gridColsClass = 'grid-cols-5' // 5x5+ grid for more participants
        }
        
        return (
          <div className={`h-full w-full p-2 md:p-4 grid ${gridColsClass} gap-2 md:gap-4 ${useFullHeight ? '' : 'overflow-y-auto'}`}>
            {participants.map((participant) => (
              <div key={participant.identity} className={useFullHeight ? 'h-full' : ''}>
                {renderParticipantTile(participant, useFullHeight)}
              </div>
            ))}
          </div>
        )

      case 'spotlight':
        // Spotlight layout: one participant large, others small
        // If only one participant total, don't show small boxes (no duplicates)
        const spotlightParticipant = spotlightParticipantId
          ? participants.find((p) => p.identity === spotlightParticipantId)
          : otherParticipants[0] || coachParticipant

        if (!spotlightParticipant) {
          return <div className="h-full w-full flex items-center justify-center text-white">No participants</div>
        }

        const totalParticipantsSpotlight = participants.length
        return (
          <div className="h-full w-full flex flex-col md:flex-row">
            {/* Main spotlight video */}
            <div className="flex-1 min-w-0" style={{ flex: '0 0 95%' }}>
              {renderParticipantTile(spotlightParticipant, true)}
            </div>
            {/* Small participant boxes (only if more than 1 participant total) */}
            {otherParticipants.length > 0 && totalParticipantsSpotlight > 1 && (
              <div className="md:w-40 md:flex-col md:gap-2 md:p-2 flex flex-row gap-2 p-2 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden">
                {otherParticipants
                  .filter((p) => p.identity !== spotlightParticipant.identity)
                  .map((participant) => renderParticipantTile(participant, false))}
              </div>
            )}
          </div>
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
        // Default layout: both boxes same size, side by side, centered
        // Always show at least one participant, even if alone
        const totalParticipants = participants.length
        const isCoachViewing = isCoach && coachParticipant
        
        // If only one participant, show them full screen
        if (totalParticipants === 1 && participants[0]) {
          return (
            <div className="h-full w-full">
              {renderParticipantTile(participants[0], true)}
            </div>
          )
        }
        
        if (isCoachViewing) {
          // Coach viewing: participants and coach same size, side by side, centered
          return (
            <div className="h-full w-full flex items-center justify-center gap-2 md:gap-4 p-2 md:p-4">
              {/* Participants - same size as coach */}
              {otherParticipants.length > 0 && (
                <div className="w-full md:w-1/2 flex-shrink-0">
                  {renderParticipantTile(otherParticipants[0], false)}
                </div>
              )}
              {/* Coach - same size as participant */}
              {coachParticipant && (
                <div className="w-full md:w-1/2 flex-shrink-0">
                  {renderParticipantTile(coachParticipant, false)}
                </div>
              )}
            </div>
          )
        } else {
          // Non-coach viewing: coach and participants same size, side by side, centered
          return (
            <div className="h-full w-full flex items-center justify-center gap-2 md:gap-4 p-2 md:p-4">
              {/* Coach - same size as participants */}
              {coachParticipant && (
                <div className="w-full md:w-1/2 flex-shrink-0">
                  {renderParticipantTile(coachParticipant, false)}
                </div>
              )}
              {/* Other participants - same size as coach */}
              {otherParticipants.length > 0 && (
                <div className="w-full md:w-1/2 flex-shrink-0">
                  {renderParticipantTile(otherParticipants[0], false)}
                </div>
              )}
            </div>
          )
        }
    }
  }

  return (
    <>
      <div
        className={`relative h-full flex flex-col transition-all duration-300 ease-in-out ${
          isPanelOpen ? "md:w-[60%] w-full" : "w-full"
        }`}
      >
        {/* Main video area - Dynamic layout based on layoutMode */}
        <div className="h-full min-h-0 relative overflow-hidden bg-black">
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
                <button
                  onClick={() => setLayoutMode('default')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    layoutMode === 'default' 
                      ? 'bg-white text-black' 
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                  title="Default Layout"
                >
                  <Users className="h-4 w-4" />
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
                  onClick={() => setLayoutMode('default')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    layoutMode === 'default' 
                      ? 'bg-white text-black' 
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                  title="Default Layout (Coach Big)"
                >
                  <Users className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

        {/* Controls - White pill-shaped bar with simple black icons */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2.5 md:py-3 rounded-full z-50 max-w-[calc(100vw-2rem)] md:max-w-none bg-white shadow-lg"
          style={{ 
            bottom: 'calc(3vh + env(safe-area-inset-bottom, 0))'
          }}
        >
          <button
            onClick={async () => {
              const micPub = Array.from(localParticipant.audioTrackPublications.values())
                .find(pub => pub.source === Track.Source.Microphone)
              if (micPub?.track) {
                if (micPub.isMuted) {
                  await micPub.track.unmute()
                } else {
                  await micPub.track.mute()
                }
              }
            }}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-transparent hover:bg-gray-100/50 text-black rounded-full h-10 w-10 md:h-12 md:w-12"
          >
            {isMicMuted ? (
              <MicOff className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
            ) : (
              <Mic className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
            )}
          </button>
          <button
            onClick={async () => {
              const cameraPub = Array.from(localParticipant.videoTrackPublications.values())
                .find(pub => pub.source === Track.Source.Camera)
              if (cameraPub?.track) {
                if (cameraPub.isMuted) {
                  await cameraPub.track.unmute()
                } else {
                  await cameraPub.track.mute()
                }
              }
            }}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-transparent hover:bg-gray-100/50 text-black rounded-full h-10 w-10 md:h-12 md:w-12"
          >
            {isCameraOff ? (
              <VideoOff className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
            ) : (
              <Video className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
            )}
          </button>
          <button
            onClick={async () => {
              await room.disconnect()
              router.push('/')
            }}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 rounded-full h-10 w-10 md:h-12 md:w-12"
          >
            <PhoneOff className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Session info - Clean, minimal badges */}
        <div className="absolute top-4 md:top-6 left-4 md:left-6 bg-black/30 backdrop-blur-sm px-3 md:px-4 py-2 md:py-2.5 rounded-xl z-10 border border-white/10">
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
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-600 dark:text-gray-400">
                                Not Joined
                              </span>
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
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

