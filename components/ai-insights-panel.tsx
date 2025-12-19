"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, Loader2, FileDown } from "lucide-react"
import { useRoomContext, useTracks } from "@livekit/components-react"
import { DataPacket_Kind, Track, ConnectionState, RoomEvent } from "livekit-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  createPoseDetector,
  estimatePoses,
  landmarksToKeypoints,
  calculateBiomechanicalAngles,
  calculateBiomechanicalMetrics,
  type PoseData,
  type PoseKeypoint,
  type PoseDetector,
} from "@/lib/pose-detection"
import { useRealtimeMetrics } from "@/lib/realtime-metrics-context"

interface AIInsight {
  participantId: string
  participantName: string
  exerciseName?: string
  postureMetrics?: {
    spineLean?: string
    neckFlexion?: string
    shoulderAlignment?: string
    pelvicSway?: string
    additionalMetrics?: string[]
  }
  movementQuality?: string
  movementPatterns?: string[]
  movementConsistency?: number
  dynamicStability?: number
  performanceInterpretation?: string
  performanceImpact?: string[]
  balanceScore: number
  symmetryScore: number
  posturalEfficiency?: number
  riskLevel?: string
  riskDescription?: string
  targetedRecommendations?: string[]
  timestamp: string
}

interface AIInsightsPanelProps {
  participants: Array<{ identity: string; name?: string }>
  participantInfo: Record<string, { firstName: string; lastName: string; fullName: string }>
  sessionOwnerId?: string | null
  sessionId?: string | null
  sessionType?: string | null // "single", "group", or "mocap"
}

interface AIMetric {
  subject_id: string // Partition key
  timestamp: string // Sort key
  session_id: string
  participant_id: string
  participant_name: string
  balance_score: number
  symmetry_score: number
  postural_efficiency?: number
  risk_level?: string
  posture_metrics?: {
    spine_lean?: string
    neck_flexion?: string
    shoulder_alignment?: string
    pelvic_sway?: string
    additional_metrics?: string[]
  }
  movement_quality?: string
  movement_patterns?: string[]
  movement_consistency?: number
  dynamic_stability?: number
}

export function AIInsightsPanel({ participants, participantInfo, sessionOwnerId, sessionId, sessionType }: AIInsightsPanelProps) {
  const room = useRoomContext()
  
  // Mark this panel as rendered for status checking
  useEffect(() => {
    const panel = document.querySelector('[data-ai-insights-panel]')
    if (!panel) {
      // Create a marker element if it doesn't exist
      const marker = document.createElement('div')
      marker.setAttribute('data-ai-insights-panel', 'true')
      marker.style.display = 'none'
      document.body.appendChild(marker)
    }
  }, [])
  // Get all camera tracks (both subscribed and unsubscribed to ensure we get all participants)
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  
  // Check if current user is the coach (session owner)
  const isCoach = room?.localParticipant?.identity === sessionOwnerId
  
  // Log coach status for debugging
  console.log(`[AI Insights] 👤 Coach check - localParticipant: ${room?.localParticipant?.identity}, sessionOwnerId: ${sessionOwnerId}, isCoach: ${isCoach}`)
  
  // Only show metrics and insights to the coach
  if (!isCoach) {
    console.log('[AI Insights] ⚠️ User is not a coach, hiding AI insights panel')
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">AI insights and metrics are only available to coaches.</p>
        </div>
      </div>
    )
  }
  
  console.log('[AI Insights] ✅ User is a coach, showing AI insights panel')
  const [insights, setInsights] = useState<AIInsight[]>([]) // Generated insights (single per participant) - only shown after clicking "Generate Session Insights"
  const [metrics, setMetrics] = useState<AIMetric[]>([]) // Real-time metrics
  const [latestMetrics, setLatestMetrics] = useState<Record<string, AIMetric>>({}) // Latest metric per participant
  const [metricsUpdateKey, setMetricsUpdateKey] = useState(0) // Force re-render key
  const [metricsTimestamp, setMetricsTimestamp] = useState<string>('') // Timestamp of last metrics update
  // Real-time angles and metrics (calculated before DB save) - shared via context
  const { setRealtimeData } = useRealtimeMetrics()
  const [showInsights, setShowInsights] = useState(false) // Flag to control whether to show insights or metrics
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameCollectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const firstAnalysisTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const insightsGenerationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const chatMetricsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const latestMetricsRef = useRef<Record<string, AIMetric>>({})
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const poseDetectorsRef = useRef<Map<string, PoseDetector>>(new Map())
  // Pose data buffer: Map<participantId, Array<PoseData>>
  const poseDataBufferRef = useRef<Map<string, Array<PoseData>>>(new Map())
  const setupCompleteRef = useRef(false) // Track if intervals have been set up
  const welcomeMessageSentRef = useRef<Set<string>>(new Set()) // Track which participants have received welcome message
  const [subjectName, setSubjectName] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState<string | null>(null) // Store subject_id for mocap sessions
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const insightsLoadedRef = useRef(false)

  // Fetch subject name from session schedule
  useEffect(() => {
    if (!sessionId) return

    const fetchSubjectName = async () => {
      try {
        // Fetch session data to get subject_id
        const sessionResponse = await fetch(`/api/sessions/${sessionId}`)
        if (!sessionResponse.ok) {
          console.error('[AI Insights] Failed to fetch session data')
          return
        }

        const sessionData = await sessionResponse.json()
        const session = sessionData.session

        // Get subject_id (for single/mocap) or first subject_id from subject_ids (for group)
        const subjectIdFromSession = session.subject_id || (session.subject_ids && session.subject_ids[0])

        if (!subjectIdFromSession) {
          console.log('[AI Insights] No subject_id found in session')
          return
        }
        
        // Store subject_id for use in analysis
        setSubjectId(subjectIdFromSession)

        // Fetch subject name
        const subjectResponse = await fetch(`/api/subjects/${subjectIdFromSession}`)
        if (!subjectResponse.ok) {
          console.error('[AI Insights] Failed to fetch subject data')
          return
        }

        const subjectData = await subjectResponse.json()
        const subject = subjectData.subject

        // Get subject name from various possible fields
        const name = subject.full_name || 
                     subject.name || 
                     (subject.f_name && subject.l_name ? `${subject.f_name} ${subject.l_name}` : null) ||
                     subjectIdFromSession

        if (name) {
          setSubjectName(name)
          console.log(`[AI Insights] Subject name set to: ${name}`)
        }
      } catch (error) {
        console.error('[AI Insights] Error fetching subject name:', error)
      }
    }

    fetchSubjectName()
  }, [sessionId])

  // NO localStorage for insights - database is the ONLY source of truth
  // All insights are fetched from DynamoDB every 30 seconds

  // Use refs for values that change frequently to avoid re-running useEffect
  const participantInfoRef = useRef(participantInfo)
  const subjectNameRef = useRef(subjectName)
  const sessionIdRef = useRef(sessionId)
  // Removed saveInsightsToStorageRef - no longer using localStorage

  // Reset loaded flag when sessionId changes
  useEffect(() => {
    insightsLoadedRef.current = false
  }, [sessionId])

  // NO localStorage for insights - database is the ONLY source of truth
  // Insights are fetched from database every 30 seconds
  useEffect(() => {
    if (!sessionId) {
      setInsights([])
      setShowInsights(false)
      return
    }
    
    // Clear any old localStorage cache to prevent stale data
    try {
      const storageKey = `ai-insights-${sessionId}`
      localStorage.removeItem(storageKey)
      console.log('[AI Insights] 🗑️ Cleared localStorage cache - database is the only source of truth')
    } catch (error) {
      // Ignore errors
    }
    
    setIsLoadingInsights(true)
  }, [sessionId])

  // Clear any old localStorage cache for metrics on mount
  // We don't use localStorage for metrics anymore - we fetch fresh data every 2 seconds
  useEffect(() => {
    if (!sessionId) return
    
    // Clear any old cache to prevent confusion
    try {
      const storageKey = `ai-metrics-${sessionId}`
      localStorage.removeItem(storageKey)
      console.log('[AI Insights] Cleared old localStorage cache for metrics (not used anymore)')
    } catch (error) {
      // Ignore errors
    }
  }, [sessionId])

  // Fetch metrics periodically to display real-time data
  useEffect(() => {
    if (!sessionId) return

    const fetchMetrics = async () => {
      try {
        console.log(`[AI Insights] Fetching metrics for session: ${sessionId} at ${new Date().toISOString()}`)
        // Add cache-busting query parameter to force fresh fetch
        const response = await fetch(`/api/ai-insights/metrics/${sessionId}?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          const fetchedMetrics = data.metrics || []
          
          console.log(`[AI Insights] 📥 Received ${fetchedMetrics.length} metrics from API at ${new Date().toISOString()}`)
          
          // Log the LATEST metric timestamp to see if new ones are coming in
          if (fetchedMetrics.length > 0) {
            const sortedByTime = [...fetchedMetrics].sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            const latest = sortedByTime[0]
            console.log(`[AI Insights] 🕐 LATEST metric in API response:`, {
              timestamp: latest.timestamp,
              balance: latest.balance_score,
              symmetry: latest.symmetry_score,
              postural: latest.postural_efficiency,
              age: `${Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 1000)} seconds ago`
            })
            
            // Log all unique timestamps to see if we're getting new ones
            const uniqueTimestamps = [...new Set(fetchedMetrics.map((m: AIMetric) => m.timestamp))].sort().reverse()
            console.log(`[AI Insights] 📅 All unique timestamps in response (${uniqueTimestamps.length}):`, uniqueTimestamps.slice(0, 5))
          }
          
          // Always update state, even if empty (to clear stale data)
          setMetrics(fetchedMetrics)
          
          // Update latest metrics per participant
          const latest: Record<string, AIMetric> = {}
          fetchedMetrics.forEach((metric: AIMetric) => {
            const pid = metric.participant_id
            if (!latest[pid] || new Date(metric.timestamp) > new Date(latest[pid].timestamp)) {
              latest[pid] = metric
            }
          })
          
          // Log what we're about to set
          console.log(`[AI Insights] 📥 Fetched ${fetchedMetrics.length} metrics, latest per participant:`, Object.keys(latest).map(pid => ({
            participantId: pid,
            name: latest[pid].participant_name,
            balance: latest[pid].balance_score,
            symmetry: latest[pid].symmetry_score,
            postural: latest[pid].postural_efficiency,
            timestamp: latest[pid].timestamp,
          })))
          
          // Check if values actually changed
          const currentLatest = latestMetrics
          let hasChanges = false
          Object.keys(latest).forEach(pid => {
            const newMetric = latest[pid]
            const oldMetric = currentLatest[pid]
            if (!oldMetric || 
                oldMetric.balance_score !== newMetric.balance_score ||
                oldMetric.symmetry_score !== newMetric.symmetry_score ||
                oldMetric.postural_efficiency !== newMetric.postural_efficiency ||
                oldMetric.timestamp !== newMetric.timestamp) {
              hasChanges = true
              console.log(`[AI Insights] 🔄 CHANGES DETECTED for ${pid}:`, {
                old: oldMetric ? { balance: oldMetric.balance_score, symmetry: oldMetric.symmetry_score, postural: oldMetric.postural_efficiency } : 'none',
                new: { balance: newMetric.balance_score, symmetry: newMetric.symmetry_score, postural: newMetric.postural_efficiency }
              })
            }
          })
          
          if (!hasChanges && Object.keys(latest).length > 0) {
            console.log(`[AI Insights] ⚠️ NO CHANGES detected - values are the same, but forcing update anyway`)
          }
          
          // Force update by creating a completely new object with deep copy
          // This ensures React detects the change even if values are the same
          const newLatestMetrics: Record<string, AIMetric> = {}
          Object.keys(latest).forEach(pid => {
            newLatestMetrics[pid] = { ...latest[pid] } // Deep copy each metric
          })
          
          const now = new Date().toISOString()
          
          // ALWAYS increment updateKey to force re-render - do this FIRST
          setMetricsUpdateKey(prev => {
            const newKey = prev + 1
            console.log(`[AI Insights] 🔑 FORCING updateKey increment: ${prev} -> ${newKey}`)
            return newKey
          })
          
          // Update timestamp
          setMetricsTimestamp(now)
          
          // Update metrics - this MUST happen to trigger re-render
          setLatestMetrics(newLatestMetrics)
          
          console.log(`[AI Insights] ✅ State updated - latestMetrics keys:`, Object.keys(newLatestMetrics), 'timestamp:', now)
          console.log(`[AI Insights] 📈 Values being set:`, Object.values(newLatestMetrics).map(m => ({
            name: m.participant_name,
            balance: m.balance_score,
            symmetry: m.symmetry_score,
            postural: m.postural_efficiency,
            timestamp: m.timestamp,
          })))
          
          // Don't save to localStorage - we fetch fresh data every 2 seconds anyway
          // localStorage was causing confusion and isn't needed for real-time metrics
        } else {
          const errorText = await response.text()
          console.error('[AI Insights] Response not OK:', response.status, errorText)
        }
      } catch (error) {
        console.error('[AI Insights] Error fetching metrics:', error)
      }
    }

    fetchMetrics() // Fetch immediately
    const interval = setInterval(fetchMetrics, 2000) // Fetch every 2 seconds (very frequent for real-time updates)

    return () => clearInterval(interval)
  }, [sessionId])

  // Debug: Log when latestMetrics changes
  useEffect(() => {
    console.log(`[AI Insights] 🔄 latestMetrics changed:`, Object.keys(latestMetrics).length, 'participants', 'updateKey:', metricsUpdateKey, 'timestamp:', metricsTimestamp)
    Object.entries(latestMetrics).forEach(([pid, metric]) => {
      console.log(`[AI Insights] 📊 Participant ${pid}: balance=${metric.balance_score}, symmetry=${metric.symmetry_score}, postural=${metric.postural_efficiency}, timestamp=${metric.timestamp}`)
    })
    // Update ref for chat posting immediately
    latestMetricsRef.current = latestMetrics
    console.log(`[AI Insights] 🔄 Updated latestMetricsRef with ${Object.keys(latestMetrics).length} participant(s) for chat posting`)
  }, [latestMetrics, metricsUpdateKey, metricsTimestamp])

  // Send welcome message to participants
  const sendWelcomeMessage = async (participantId: string, participantName: string) => {
    const currentRoom = room
    const currentSessionId = sessionIdRef.current || sessionId
    
    if (!currentRoom || !currentSessionId) {
      console.log('[AI Insights] ⚠️ Cannot send welcome message - room or sessionId missing', {
        hasRoom: !!currentRoom,
        hasSessionId: !!currentSessionId,
        roomState: currentRoom?.state
      })
      return
    }

    const welcomeMessage = `👋 Welcome to the session, ${participantName}! I'm your AI Coach. I'll be monitoring your movement and providing real-time feedback throughout the session. Let's get started!`

    console.log(`[AI Insights] 💬 Sending welcome message to ${participantName}`)

    try {
      // Save to database
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          participantId: 'ai_agent',
          participantName: 'AI Coach',
          message: welcomeMessage,
          messageType: 'ai_agent',
          metadata: {
            message_type: 'welcome',
            participant_id: participantId,
          },
        }),
      })

      if (response.ok) {
        console.log(`[AI Insights] ✅ Successfully saved welcome message for ${participantName}`)
        
        // Also send via LiveKit data channel for real-time delivery
        if (currentRoom.state === ConnectionState.Connected && currentRoom.localParticipant) {
          const chatMessage = {
            message_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            participant_id: 'ai_agent',
            participant_name: 'AI Coach',
            message: welcomeMessage,
            message_type: 'ai_agent' as const,
            timestamp: new Date().toISOString(),
            metadata: {
              message_type: 'welcome',
              participant_id: participantId,
            },
          }

          const data = JSON.stringify({
            type: 'chat_message',
            message: chatMessage,
          })

          currentRoom.localParticipant.publishData(
            new TextEncoder().encode(data),
            { reliable: true }
          )
          console.log(`[AI Insights] ✅ Published welcome message via LiveKit data channel for ${participantName}`)
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('[AI Insights] ❌ Failed to send welcome message:', response.status, errorText)
      }
    } catch (error) {
      console.error('[AI Insights] ❌ Error sending welcome message:', error)
    }
  }

  // Post metrics to chat as AI coach bot every 30 seconds
  const postMetricsToChat = async (metricsToPost: Record<string, AIMetric>) => {
    console.log('[AI Insights] 💬 postMetricsToChat called with metrics:', Object.keys(metricsToPost).length, 'participants')
    
    if (!room) {
      console.log('[AI Insights] ⚠️ No room available for chat posting')
      return
    }

    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) {
      console.log('[AI Insights] ⚠️ No sessionId available for chat posting')
      return
    }

    const currentSessionOwnerId = sessionOwnerId
    const currentSessionType = sessionType

    console.log('[AI Insights] 💬 Processing metrics for chat:', {
      sessionId: currentSessionId,
      sessionOwnerId: currentSessionOwnerId,
      sessionType: currentSessionType,
      metricsCount: Object.keys(metricsToPost).length
    })

    // Post a message for each participant with metrics
    for (const [participantId, metric] of Object.entries(metricsToPost)) {
      // Skip coach metrics for non-mocap sessions
      if (currentSessionOwnerId && participantId === currentSessionOwnerId && currentSessionType !== 'mocap') {
        console.log(`[AI Insights] ⏭️ Skipping coach metrics for ${participantId}`)
        continue
      }

      const participantName = metric.participant_name
      const balance = metric.balance_score
      const symmetry = metric.symmetry_score
      const postural = metric.postural_efficiency || 0

      console.log(`[AI Insights] 💬 Creating message for ${participantName}:`, { balance, symmetry, postural })

      // Create encouraging message based on metrics
      let message = `📊 ${participantName}: `
      const messages: string[] = []

      if (balance >= 80) {
        messages.push(`Excellent balance at ${balance}%! Keep it up!`)
      } else if (balance >= 60) {
        messages.push(`Good balance at ${balance}%. Focus on maintaining stability.`)
      } else {
        messages.push(`Balance is at ${balance}%. Try to improve your stability.`)
      }

      if (symmetry >= 80) {
        messages.push(`Great symmetry at ${symmetry}%!`)
      } else if (symmetry >= 60) {
        messages.push(`Symmetry is ${symmetry}%. Work on balanced movement.`)
      } else {
        messages.push(`Symmetry needs improvement (${symmetry}%). Focus on equal movement on both sides.`)
      }

      if (postural >= 80) {
        messages.push(`Excellent posture at ${postural}%!`)
      } else if (postural >= 60) {
        messages.push(`Posture is good at ${postural}%.`)
      } else {
        messages.push(`Posture could be improved (${postural}%).`)
      }

      message += messages.join(' ')

      console.log(`[AI Insights] 💬 Sending message to chat: "${message}"`)

      try {
        // Save to database
        const response = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            participantId: 'ai_agent',
            participantName: 'AI Coach',
            message: message,
            messageType: 'ai_agent',
            metadata: {
              metric_type: 'general',
              participant_id: participantId,
              values: {
                balance_score: balance,
                symmetry_score: symmetry,
                postural_efficiency: postural,
              },
            },
          }),
        })

        if (response.ok) {
          console.log(`[AI Insights] ✅ Successfully saved message to database for ${participantName}`)
          
          // Also send via LiveKit data channel for real-time delivery
          if (room.state === ConnectionState.Connected && room.localParticipant) {
            const chatMessage = {
              message_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              participant_id: 'ai_agent',
              participant_name: 'AI Coach',
              message: message,
              message_type: 'ai_agent' as const,
              timestamp: new Date().toISOString(),
              metadata: {
                metric_type: 'general' as const,
                participant_id: participantId,
                values: {
                  balance_score: balance,
                  symmetry_score: symmetry,
                  postural_efficiency: postural,
                },
              },
            }

            const data = JSON.stringify({
              type: 'chat_message',
              message: chatMessage,
            })

            room.localParticipant.publishData(
              new TextEncoder().encode(data),
              { reliable: true }
            )
            console.log(`[AI Insights] ✅ Published message via LiveKit data channel for ${participantName}`)
          } else {
            console.log(`[AI Insights] ⚠️ Room not connected or no local participant - skipping LiveKit publish`)
          }
          console.log(`[AI Insights] 💬 Posted metrics to chat for ${participantName}`)
        } else {
          const errorText = await response.text().catch(() => 'Unknown error')
          console.error('[AI Insights] ❌ Failed to post metrics to chat:', response.status, errorText)
        }
      } catch (error) {
        console.error('[AI Insights] ❌ Error posting metrics to chat:', error)
      }
    }
  }

  // Auto-generate insights every 30 seconds when metrics are available
  // Uses latest metrics from the database to generate fresh insights
  useEffect(() => {
    if (!sessionId) return

    // Only generate insights if we have metrics
    const hasMetrics = Object.keys(latestMetrics).length > 0 || metrics.length > 0
    if (!hasMetrics) {
      console.log('[AI Insights] ⏸️ Skipping auto-insight generation - no metrics available yet')
      return
    }

    console.log('[AI Insights] 🤖 Setting up automatic insight generation (every 30 seconds)')
    console.log('[AI Insights] 📊 Current metrics available:', Object.keys(latestMetrics).length, 'participant(s)')
    
    // Clear any existing interval
    if (insightsGenerationIntervalRef.current) {
      clearInterval(insightsGenerationIntervalRef.current)
      insightsGenerationIntervalRef.current = null
    }

    // Generate insights using the latest metrics from database
    const generateInsights = async () => {
      if (!sessionId || isGenerating) {
        console.log('[AI Insights] ⏸️ Skipping insight generation - sessionId missing or already generating')
        return
      }

      // Always use latestMetrics (which is updated every 2 seconds from database)
      const currentMetrics = Object.keys(latestMetrics).length > 0 ? latestMetrics : {}
      const hasCurrentMetrics = Object.keys(currentMetrics).length > 0 || metrics.length > 0
      
      if (!hasCurrentMetrics) {
        console.log('[AI Insights] ⏸️ Skipping insight generation - no metrics available')
        return
      }

      console.log('[AI Insights] 🤖 Auto-generating insights from LATEST metrics...')
      console.log('[AI Insights] 📊 Using metrics from', Object.keys(currentMetrics).length, 'participant(s)')
      await handleGenerateInsights()
    }

    // Generate first insights after 30 seconds (to allow metrics to accumulate)
    const firstGenerationTimeout = setTimeout(() => {
      generateInsights()
      
      // Then set up recurring interval
      insightsGenerationIntervalRef.current = setInterval(() => {
        console.log('[AI Insights] 🤖 Recurring auto-insight generation triggered (every 30 seconds)')
        generateInsights()
      }, 30000) // Every 30 seconds
    }, 30000) // Start after 30 seconds

    return () => {
      clearTimeout(firstGenerationTimeout)
      if (insightsGenerationIntervalRef.current) {
        clearInterval(insightsGenerationIntervalRef.current)
        insightsGenerationIntervalRef.current = null
      }
    }
  }, [sessionId, latestMetrics, metrics.length, isGenerating])

  // Post metrics to chat as AI coach bot every 30 seconds
  // Set up the interval once when room is connected, then it will check for metrics on each run
  useEffect(() => {
    if (!sessionId) {
      console.log('[AI Insights] ⏸️ Skipping chat metrics setup - sessionId missing')
      return
    }

    if (!room) {
      console.log('[AI Insights] ⏸️ Skipping chat metrics setup - room not available')
      return
    }

    // Wait for room to be connected
    if (room.state !== ConnectionState.Connected) {
      console.log('[AI Insights] ⏸️ Room not connected yet, state:', room.state, '- will set up when connected')
      return
    }

    console.log('[AI Insights] 💬 Setting up automatic chat metrics posting (every 30 seconds)')
    console.log('[AI Insights] 💬 Room state:', room.state)
    
    // Clear any existing interval
    if (chatMetricsIntervalRef.current) {
      console.log('[AI Insights] 💬 Clearing existing chat metrics interval')
      clearInterval(chatMetricsIntervalRef.current)
      chatMetricsIntervalRef.current = null
    }

    // Post metrics to chat every 30 seconds
    const postMetrics = async () => {
      // Check room is still connected
      if (!room || room.state !== ConnectionState.Connected) {
        console.log('[AI Insights] ⏸️ Room not connected, skipping chat post')
        return
      }

      // Get latest metrics from ref (always up-to-date)
      const currentMetrics = { ...latestMetricsRef.current }
      console.log('[AI Insights] 💬 postMetrics called at:', new Date().toISOString())
      console.log('[AI Insights] 💬 postMetrics called - metrics count:', Object.keys(currentMetrics).length)
      console.log('[AI Insights] 💬 Metrics keys:', Object.keys(currentMetrics))
      console.log('[AI Insights] 💬 Metrics ref content:', Object.entries(currentMetrics).map(([id, m]) => ({
        id,
        name: m.participant_name,
        balance: m.balance_score,
        symmetry: m.symmetry_score,
        postural: m.postural_efficiency
      })))
      console.log('[AI Insights] 💬 latestMetrics state (for comparison):', Object.keys(latestMetrics).length, 'participants')
      
      if (Object.keys(currentMetrics).length === 0) {
        console.log('[AI Insights] ⏸️ No metrics to post to chat - will retry on next interval')
        console.log('[AI Insights] 💬 latestMetricsRef.current is empty - metrics may not be collected yet')
        console.log('[AI Insights] 💬 latestMetrics state has:', Object.keys(latestMetrics).length, 'participants')
        return
      }

      console.log('[AI Insights] 💬 Posting metrics to chat...', Object.keys(currentMetrics))
      try {
        await postMetricsToChat(currentMetrics)
        console.log('[AI Insights] ✅ Successfully completed postMetricsToChat at', new Date().toISOString())
      } catch (error) {
        console.error('[AI Insights] ❌ Error in postMetricsToChat:', error)
      }
    }

    // Post first metrics after 5 seconds (if metrics available), then every 30 seconds
    // The interval will check for metrics on each run, so it's fine if metrics aren't available yet
    console.log(`[AI Insights] 💬 Scheduling first chat post in 5 seconds (if metrics available)...`)
    
    const firstPostTimeout = setTimeout(() => {
      console.log('[AI Insights] 💬 First chat post timeout fired!')
      postMetrics()
      
      // Then set up recurring interval
      chatMetricsIntervalRef.current = setInterval(() => {
        const now = new Date().toISOString()
        console.log(`[AI Insights] 💬 Recurring chat metrics posting triggered at ${now} (every 30 seconds)`)
        postMetrics()
      }, 30000) // Every 30 seconds
      
      console.log('[AI Insights] ✅ Chat metrics interval set up successfully. Will post every 30 seconds.')
    }, 5000) // Start after 5 seconds (reduced from 30 seconds for faster initial post)

    return () => {
      console.log('[AI Insights] 💬 Cleaning up chat metrics interval')
      clearTimeout(firstPostTimeout)
      if (chatMetricsIntervalRef.current) {
        clearInterval(chatMetricsIntervalRef.current)
        chatMetricsIntervalRef.current = null
      }
    }
  }, [sessionId, room?.state]) // Only depend on sessionId and room state - don't re-run when metrics change

  // Send welcome message when participants join (immediately)
  useEffect(() => {
    if (!sessionId || !room || room.state !== ConnectionState.Connected) {
      console.log('[AI Insights] 👋 Welcome message effect skipped - missing requirements:', {
        hasSessionId: !!sessionId,
        hasRoom: !!room,
        roomState: room?.state
      })
      return
    }

    // Listen for participant connected events
    const handleParticipantConnected = (participant: any) => {
      if (!participant || !participant.identity) return

      const participantId = participant.identity
      
      // Skip coach for non-mocap sessions
      if (sessionOwnerId && participantId === sessionOwnerId && sessionType !== 'mocap') {
        console.log(`[AI Insights] 👋 Skipping welcome for coach: ${participantId}`)
        return
      }

      // Skip if already sent welcome message
      if (welcomeMessageSentRef.current.has(participantId)) {
        console.log(`[AI Insights] 👋 Already sent welcome to: ${participantId}`)
        return
      }

      // Mark as sent immediately to prevent duplicates
      welcomeMessageSentRef.current.add(participantId)

      // Get participant name
      const participantName = participantInfo[participantId]?.fullName || participant.name || participantId
      
      console.log(`[AI Insights] 👋 Participant connected: ${participantName} (${participantId}) - sending welcome message immediately`)
      
      // Send welcome message immediately
      sendWelcomeMessage(participantId, participantName)
    }

    // Check existing participants when effect runs
    const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())].filter(Boolean)
    allParticipants.forEach(participant => {
      if (!participant) return
      const participantId = participant.identity
      
      // Skip coach for non-mocap sessions
      if (sessionOwnerId && participantId === sessionOwnerId && sessionType !== 'mocap') {
        return
      }

      // Skip if already sent welcome message
      if (welcomeMessageSentRef.current.has(participantId)) {
        return
      }

      // Mark as sent immediately to prevent duplicates
      welcomeMessageSentRef.current.add(participantId)

      // Get participant name
      const participantName = participantInfo[participantId]?.fullName || participant.name || participantId
      
      console.log(`[AI Insights] 👋 Existing participant found: ${participantName} (${participantId}) - sending welcome message immediately`)
      
      // Send welcome message immediately
      sendWelcomeMessage(participantId, participantName)
    })

    // Listen for new participants joining
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected)

    // Cleanup
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected)
    }
  }, [sessionId, room, room?.state, participantInfo, sessionOwnerId, sessionType])

  // Fetch saved AI insights from database periodically
  // This runs every 30 seconds to get the latest insights (especially after auto-generation)
  useEffect(() => {
    if (!sessionId) return

    const fetchSavedInsights = async () => {
      try {
        console.log('[AI Insights] Fetching saved insights for session:', sessionId)
        const response = await fetch(`/api/ai-insights/session/${sessionId}`)
        
        if (response.ok) {
          const data = await response.json()
          const savedInsights = data.insights || []
          
          console.log(`[AI Insights] Loaded ${savedInsights.length} saved insights from database`)
          
          // Convert database format to component format
          const convertedInsights: AIInsight[] = savedInsights.map((dbInsight: any) => {
            // Extract session_id from composite key (format: sessionId#insightId)
            const sessionIdFromKey = dbInsight.session_id?.split('#')[0] || sessionId
            
            return {
              participantId: dbInsight.participant_id || dbInsight.subject_id,
              participantName: dbInsight.participant_name || dbInsight.participant_id,
              exerciseName: dbInsight.exercise_name,
              postureMetrics: dbInsight.posture_metrics ? {
                spineLean: dbInsight.posture_metrics.spine_lean,
                neckFlexion: dbInsight.posture_metrics.neck_flexion,
                shoulderAlignment: dbInsight.posture_metrics.shoulder_alignment,
                pelvicSway: dbInsight.posture_metrics.pelvic_sway,
                additionalMetrics: dbInsight.posture_metrics.additional_metrics,
              } : undefined,
              movementQuality: dbInsight.movement_quality,
              movementPatterns: dbInsight.movement_patterns,
              movementConsistency: dbInsight.movement_consistency,
              dynamicStability: dbInsight.dynamic_stability,
              performanceInterpretation: dbInsight.performance_interpretation,
              performanceImpact: dbInsight.performance_impact,
              balanceScore: dbInsight.balance_score || 0,
              symmetryScore: dbInsight.symmetry_score || 0,
              posturalEfficiency: dbInsight.postural_efficiency,
              riskLevel: dbInsight.risk_level,
              riskDescription: dbInsight.risk_description,
              targetedRecommendations: dbInsight.targeted_recommendations,
              timestamp: dbInsight.timestamp || dbInsight.created_at,
            }
          })
          
          // Database is the ONLY source of truth - always use database insights
          // NO localStorage, NO merging with prev state - just use what's in the database
          setInsights((prev) => {
            if (convertedInsights.length > 0) {
              // Use ONLY database insights - no merging with prev state
              const databaseInsights = convertedInsights
              
              // Sort by timestamp descending (newest first)
              databaseInsights.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              
              // Check if insights actually changed
              const prevTimestamp = prev.length > 0 ? prev[0]?.timestamp : null
              const newTimestamp = databaseInsights.length > 0 ? databaseInsights[0]?.timestamp : null
              const prevContent = prev.length > 0 ? JSON.stringify(prev[0]) : null
              const newContent = databaseInsights.length > 0 ? JSON.stringify(databaseInsights[0]) : null
              const hasChanged = prevTimestamp !== newTimestamp || prevContent !== newContent || prev.length !== databaseInsights.length
              
              if (hasChanged) {
                console.log(`[AI Insights] ✅ UPDATED insights state with ${databaseInsights.length} insight(s) from database (NO localStorage)`)
                console.log(`[AI Insights] 📊 Previous timestamp: ${prevTimestamp}, New timestamp: ${newTimestamp}`)
                console.log(`[AI Insights] 📊 Previous count: ${prev.length}, New count: ${databaseInsights.length}`)
                console.log(`[AI Insights] 📊 Content changed: ${prevContent !== newContent}`)
              } else {
                console.log(`[AI Insights] ℹ️ Insights unchanged (${databaseInsights.length} insight(s), timestamp: ${newTimestamp})`)
              }
              
              // DO NOT save to localStorage - database is the only source of truth
              return databaseInsights
            } else {
              // If database is empty, clear insights (don't keep stale data)
              console.log('[AI Insights] Database empty, clearing insights')
              return []
            }
          })
          
          insightsLoadedRef.current = true
        } else {
          console.error('[AI Insights] Failed to fetch saved insights:', response.status)
        }
      } catch (error) {
        console.error('[AI Insights] Error fetching saved insights:', error)
      } finally {
        setIsLoadingInsights(false)
      }
    }

    // Fetch immediately on mount
    fetchSavedInsights()
    
    // Then fetch every 30 seconds to get latest insights (especially after auto-generation)
    const intervalId = setInterval(() => {
      console.log('[AI Insights] 🔄 Periodically fetching latest insights from database (every 30 seconds)...')
      fetchSavedInsights()
    }, 30000) // Every 30 seconds (same as auto-generation interval)

    return () => {
      clearInterval(intervalId)
    }
  }, [sessionId])

  // Listen for data channel messages from AI agent
  useEffect(() => {
    if (!room) return

    const handleDataReceived = (payload: Uint8Array, participant?: any, kind?: DataPacket_Kind) => {
      try {
        const decoder = new TextDecoder()
        const message = JSON.parse(decoder.decode(payload))
        
        if (message.type === 'ai-insight') {
          const newInsight: AIInsight = {
            participantId: message.participantId,
            participantName: message.participantName || message.participantId,
            exerciseName: message.exerciseName,
            postureMetrics: message.postureMetrics,
            movementQuality: message.movementQuality,
            movementPatterns: message.movementPatterns,
            movementConsistency: message.movementConsistency,
            dynamicStability: message.dynamicStability,
            performanceInterpretation: message.performanceInterpretation,
            performanceImpact: message.performanceImpact,
            balanceScore: message.balanceScore || 0,
            symmetryScore: message.symmetryScore || 0,
            posturalEfficiency: message.posturalEfficiency,
            riskLevel: message.riskLevel,
            riskDescription: message.riskDescription,
            targetedRecommendations: message.targetedRecommendations,
            timestamp: message.timestamp || new Date().toISOString(),
          }

          // Update insights - keep only the latest per participant/exercise
          setInsights((prev) => {
            const filtered = prev.filter(
              (i) => !(i.participantId === newInsight.participantId && i.exerciseName === newInsight.exerciseName)
            )
            const updated = [...filtered, newInsight].slice(-20) // Keep last 20 insights total
            // DO NOT save to localStorage - database is the only source of truth
            return updated
          })
        }
      } catch (error) {
        console.error('Error parsing AI insight data:', error)
      }
    }

    room.on('dataReceived', handleDataReceived)

    return () => {
      room.off('dataReceived', handleDataReceived)
    }
  }, [room])

  // Set up video elements for pose detection
  useEffect(() => {
    if (!room) {
      console.log('[AI Insights] ⚠️ No room available, skipping video element setup')
      return
    }

    if (room.state !== ConnectionState.Connected) {
      console.log('[AI Insights] ⚠️ Room not connected, skipping video element setup. State:', room.state)
      return
    }

    console.log(`[AI Insights] 🎥 Setting up video elements. Found ${tracks.length} camera tracks`)
    
    if (tracks.length === 0) {
      console.warn('[AI Insights] ⚠️ No camera tracks found! This might mean:')
      console.warn('[AI Insights]   1. Participants haven\'t enabled their cameras yet')
      console.warn('[AI Insights]   2. Tracks aren\'t subscribed yet')
      console.warn('[AI Insights]   3. Room is still connecting')
      
      // Try to get tracks directly from participants as fallback
      const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())].filter(Boolean)
      console.log(`[AI Insights] 🔍 Checking ${allParticipants.length} participants directly for camera tracks...`)
      
      allParticipants.forEach(p => {
        const cameraTracks = Array.from(p.trackPublications.values()).filter(t => 
          t.kind === 'video' && t.source === Track.Source.Camera
        )
        console.log(`[AI Insights]   Participant ${p.identity}: ${cameraTracks.length} camera track(s)`, {
          tracks: cameraTracks.map(t => ({
            trackSid: t.trackSid,
            isSubscribed: t.isSubscribed,
            hasTrack: !!t.track,
            hasMediaStreamTrack: !!t.track?.mediaStreamTrack
          }))
        })
        
        // If track exists but isn't subscribed, subscribe to it
        cameraTracks.forEach(trackPub => {
          if (!trackPub.isSubscribed && trackPub.track) {
            console.log(`[AI Insights] 🔄 Subscribing to track ${trackPub.trackSid} for ${p.identity}`)
            trackPub.setSubscribed(true)
          }
        })
      })
      
      // Return early but set up a retry
      setTimeout(() => {
        console.log('[AI Insights] 🔄 Retrying video element setup after 2 seconds...')
        // This will trigger the useEffect again when tracks become available
      }, 2000)
      return
    }
    
    console.log(`[AI Insights] 🎥 Track details:`, tracks.map(t => ({
      participantId: t.participant?.identity,
      participantName: t.participant?.name,
      hasPublication: !!t.publication,
      hasPublicationTrack: !!t.publication?.track,
      hasTrack: !!t.track,
      hasMediaStreamTrack: !!t.track?.mediaStreamTrack || !!t.publication?.track?.mediaStreamTrack,
      trackKind: t.publication?.track?.kind || t.track?.kind,
      trackSource: t.publication?.track?.source || t.track?.source,
      isSubscribed: t.publication?.isSubscribed,
      trackSid: t.publication?.trackSid || t.track?.sid
    })))
    
    // Also log all participants and their tracks in detail
    console.log(`[AI Insights] 🎥 All remote participants in room:`, Array.from(room.remoteParticipants.values()).map(p => {
      const cameraTracks = Array.from(p.trackPublications.values()).filter(t => t.kind === 'video' && t.source === Track.Source.Camera)
      return {
        identity: p.identity,
        name: p.name,
        cameraTrackCount: cameraTracks.length,
        cameraTracks: cameraTracks.map(t => ({
          trackSid: t.trackSid,
          isSubscribed: t.isSubscribed,
          isMuted: t.isMuted,
          track: t.track ? 'exists' : 'missing'
        }))
      }
    }))
    console.log(`[AI Insights] 🎥 Local participant:`, {
      identity: room.localParticipant?.identity,
      name: room.localParticipant?.name,
      cameraTracks: Array.from(room.localParticipant?.trackPublications.values() || []).filter(t => t.kind === 'video' && t.source === Track.Source.Camera).map(t => ({
        trackSid: t.trackSid,
        isSubscribed: t.isSubscribed,
        isMuted: t.isMuted,
        track: t.track ? 'exists' : 'missing'
      }))
    })
    
    // Log all track publications to see what's available
    const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())].filter(Boolean)
    console.log(`[AI Insights] 🎥 All track publications across all participants:`, allParticipants.map(p => ({
      identity: p?.identity,
      name: p?.name,
      allTracks: Array.from(p?.trackPublications.values() || []).map(t => ({
        kind: t.kind,
        source: t.source,
        trackSid: t.trackSid,
        isSubscribed: t.isSubscribed,
        hasTrack: !!t.track
      }))
    })))

    // Create video elements for each track
    tracks.forEach((trackRef) => {
      if (!trackRef.participant) {
        console.log('[AI Insights] ⚠️ Skipping track - missing participant')
        return
      }

      // Try to get track from publication first, then from trackRef directly
      let track = trackRef.publication?.track || trackRef.track
      
      // If no track but we have a publication, try subscribing to it
      if (!track && trackRef.publication) {
        console.log(`[AI Insights] 🔄 Track not available, attempting to subscribe for ${trackRef.participant.identity}`)
        trackRef.publication.setSubscribed(true)
        // Wait a bit for subscription to complete
        setTimeout(() => {
          track = trackRef.publication?.track || trackRef.track
          if (track) {
            console.log(`[AI Insights] ✅ Track available after subscription for ${trackRef.participant.identity}`)
          }
        }, 500)
      }
      
      if (!track) {
        console.log('[AI Insights] ⚠️ Skipping track - no track available', {
          participantId: trackRef.participant.identity,
          hasPublication: !!trackRef.publication,
          hasTrack: !!trackRef.track,
          publicationTrackSid: trackRef.publication?.trackSid
        })
        return
      }
      
      const participantId = trackRef.participant.identity
      if (videoElementsRef.current.has(participantId)) {
        console.log(`[AI Insights] ✅ Video element already exists for ${participantId}`)
        return
      }

      console.log(`[AI Insights] 🎬 Creating video element for participant: ${participantId}`)
      const videoElement = document.createElement('video')
      videoElement.autoplay = true
      videoElement.playsInline = true
      videoElement.muted = true // Mute to avoid audio issues
      videoElement.style.display = 'none'
      document.body.appendChild(videoElement)

      // Set up event handlers before setting srcObject
      videoElement.addEventListener('loadedmetadata', () => {
        console.log(`[AI Insights] ✅ Video element ready for ${participantId} - dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`)
        // Try to play after metadata is loaded
        videoElement.play().catch((error) => {
          // Ignore play() errors - they're often harmless (e.g., if video is already playing)
          if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
            console.warn(`[AI Insights] ⚠️ Could not play video for ${participantId}:`, error.name)
          }
        })
      })

      videoElement.addEventListener('error', (e) => {
        console.error(`[AI Insights] ❌ Video element error for ${participantId}:`, e)
      })

      // Set srcObject after event handlers are set up
      // Use mediaStreamTrack from the track object
      const mediaStreamTrack = track.mediaStreamTrack
      if (!mediaStreamTrack) {
        console.error(`[AI Insights] ❌ No mediaStreamTrack available for ${participantId}`)
        return
      }
      
      const mediaStream = new MediaStream([mediaStreamTrack])
      videoElement.srcObject = mediaStream
      
      // Try to play, but don't worry if it fails (autoplay will handle it)
      videoElement.play().catch((error) => {
        // AbortError is common and harmless - it means play() was interrupted by a new load
        if (error.name === 'AbortError') {
          // This is expected when srcObject changes, ignore it
          return
        }
        // NotAllowedError means autoplay was blocked, but autoplay attribute should handle it
        if (error.name === 'NotAllowedError') {
          console.warn(`[AI Insights] ⚠️ Autoplay blocked for ${participantId}, but autoplay attribute should handle it`)
          return
        }
        // Log other errors
        console.warn(`[AI Insights] ⚠️ Video play() error for ${participantId}:`, error.name, error.message)
      })

      videoElementsRef.current.set(participantId, videoElement)
      console.log(`[AI Insights] ✅ Video element created and added for ${participantId}`)

      // Pose detector will be initialized on-demand in processPoseDetection
      // This avoids race conditions with async initialization
    })
    
    console.log(`[AI Insights] 📊 Total video elements: ${videoElementsRef.current.size}`)
    
    // Listen for new tracks being published
    const handleTrackPublished = (publication: TrackPublication, participant: any) => {
      if (publication.kind === 'video' && publication.source === Track.Source.Camera) {
        console.log(`[AI Insights] 🎬 New camera track published for ${participant.identity}`)
        // Subscribe to the track
        if (!publication.isSubscribed) {
          publication.setSubscribed(true)
        }
        // The useEffect will re-run when tracks change, so video element will be created
      }
    }
    
    // Listen for track subscriptions
    const handleTrackSubscribed = (track: any, publication: TrackPublication, participant: any) => {
      if (track.kind === 'video' && publication.source === Track.Source.Camera) {
        console.log(`[AI Insights] ✅ Camera track subscribed for ${participant.identity}`)
        // The useEffect will re-run when tracks change
      }
    }
    
    room.on('trackPublished', handleTrackPublished)
    room.on('trackSubscribed', handleTrackSubscribed)
    
    // If pose detection is already set up but hasn't started yet, trigger it now
    if (setupCompleteRef.current && frameCollectionIntervalRef.current && videoElementsRef.current.size > 0) {
      console.log('[AI Insights] Video elements added after setup, triggering immediate pose detection')
      setTimeout(() => {
        if (room && room.state === ConnectionState.Connected) {
          console.log('[AI Insights] Manually triggering pose detection after video element creation')
          ;(window as any).__triggerPoseDetection = true
        }
      }, 1000)
    }
    
    return () => {
      room.off('trackPublished', handleTrackPublished)
      room.off('trackSubscribed', handleTrackSubscribed)
      
      // Cleanup video elements and pose detectors
      videoElementsRef.current.forEach((video, participantId) => {
        video.srcObject = null
        document.body.removeChild(video)
        
        // Clean up pose detector
        const pose = poseDetectorsRef.current.get(participantId)
        if (pose) {
          // MediaPipe Pose doesn't have a close() method, just remove from ref
          poseDetectorsRef.current.delete(participantId)
        }
      })
      videoElementsRef.current.clear()
      poseDetectorsRef.current.clear()
    }
  }, [room, tracks])

  // Update refs when values change (without triggering useEffect)
  useEffect(() => {
    participantInfoRef.current = participantInfo
  }, [participantInfo])

  const subjectIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    subjectNameRef.current = subjectName
  }, [subjectName])
  
  useEffect(() => {
    subjectIdRef.current = subjectId
  }, [subjectId])

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    // Removed - no longer using localStorage for insights
  }, [])

  // Collect pose data every second and analyze every 10 seconds
  // Only set up once when room and video elements are available
  useEffect(() => {
    if (!room) {
      console.log('[AI Insights] Skipping setup - room not available')
      return
    }

    // Only set up intervals once
    if (setupCompleteRef.current) {
      console.log('[AI Insights] Intervals already set up, skipping')
      return
    }

    console.log('[AI Insights] Setting up pose detection intervals for the first time')

    // Clear any existing intervals/timeouts before setting up new ones (safety check)
    if (frameCollectionIntervalRef.current) {
      clearInterval(frameCollectionIntervalRef.current)
      frameCollectionIntervalRef.current = null
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }
    if (firstAnalysisTimeoutRef.current) {
      clearTimeout(firstAnalysisTimeoutRef.current)
      firstAnalysisTimeoutRef.current = null
    }

    // Initialize pose detector for a participant if not already initialized
    const ensurePoseDetector = async (participantId: string) => {
      if (poseDetectorsRef.current.has(participantId)) {
        return poseDetectorsRef.current.get(participantId)!;
      }

      try {
        const detector = await createPoseDetector();
        poseDetectorsRef.current.set(participantId, detector);
        console.log(`[AI Insights] Initialized pose detector for ${participantId}`);
        return detector;
      } catch (error) {
        console.error(`[AI Insights] Error initializing pose detector for ${participantId}:`, error);
        return null;
      }
    };

    // Process video frames for pose detection
    const processPoseDetection = async () => {
      // Only process if room is connected
      if (!room || room.state !== ConnectionState.Connected) {
        console.log('[AI Insights] ⚠️ Room not connected, skipping pose detection');
        return;
      }

      const videoElementsCount = videoElementsRef.current.size;
      console.log(`[AI Insights] 🔍 Processing pose detection - ${videoElementsCount} video elements available`);
      
      // Skip processing if already processing (prevent overlapping calls)
      if ((window as any).__poseDetectionProcessing) {
        console.log('[AI Insights] ⏸️ Pose detection already in progress, skipping this cycle');
            return;
          }
      (window as any).__poseDetectionProcessing = true;

      try {
        // Process only ONE participant at a time to prevent browser hangs
        // Process the first available participant, skip others this cycle
        const entries = Array.from(videoElementsRef.current.entries());
        if (entries.length === 0) {
          console.log('[AI Insights] ⚠️ No video elements available for pose detection');
          // Set status for UI
          ;(window as any).__poseDetectionStatus = 'no_video_elements'
          return;
        }
        
        // Set status
        ;(window as any).__poseDetectionStatus = 'processing'
        
        console.log(`[AI Insights] 🎯 Processing ${entries.length} participant(s) - will process first one this cycle`);

        // Only process the first participant to reduce load
        // Skip coach for non-mocap sessions (coach is just observing, not being analyzed)
        let participantToProcess = entries.find(([pid]) => {
          const isMocapSession = sessionType === 'mocap'
          const isCoach = sessionOwnerId && pid === sessionOwnerId
          // For mocap: process coach (they're pointing camera at athlete)
          // For non-mocap: skip coach, process participants
          return isMocapSession || !isCoach
        })
        
        // If no non-coach participant found, use first one anyway (for mocap or if coach is the only one)
        if (!participantToProcess) {
          participantToProcess = entries[0]
        }
        
        const [participantId, videoElement] = participantToProcess
        
        // Log which participant we're processing and why
        const isMocapSession = sessionType === 'mocap'
        const isCoach = sessionOwnerId && participantId === sessionOwnerId
        console.log(`[AI Insights] 🎯 Selected participant for pose detection: ${participantId}`, {
          isCoach,
          isMocapSession,
          totalEntries: entries.length,
          allParticipants: entries.map(([pid]) => pid)
        })
        
        if (!videoElement) {
          console.log(`[AI Insights] No video element for ${participantId}`);
          return;
        }

        // Check video element state
        console.log(`[AI Insights] 📹 Video element state for ${participantId}:`, {
          readyState: videoElement.readyState,
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          paused: videoElement.paused,
          ended: videoElement.ended,
          hasSrcObject: !!videoElement.srcObject,
          currentTime: videoElement.currentTime
        });

        if (videoElement.readyState < 2) {
          console.log(`[AI Insights] ⏸️ Video element not ready for ${participantId} (readyState: ${videoElement.readyState})`);
          return;
        }

        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          console.log(`[AI Insights] ⚠️ Video element has invalid dimensions for ${participantId}: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
          return;
        }

        // Ensure pose detector is initialized (without timeout - let it take as long as needed)
        let detector = poseDetectorsRef.current.get(participantId);
        if (!detector) {
          console.log(`[AI Insights] Initializing pose detector for ${participantId}...`);
          try {
            detector = await ensurePoseDetector(participantId);
            if (!detector) {
              console.error(`[AI Insights] Failed to initialize pose detector for ${participantId}`);
              return;
            }
            console.log(`[AI Insights] Pose detector initialized for ${participantId}`);
          } catch (initError) {
            console.error(`[AI Insights] Pose detector initialization failed:`, initError);
            // Don't return - continue without pose detection rather than blocking
            console.warn(`[AI Insights] Continuing without pose detection for ${participantId}`);
            return;
          }
        }

        try {
          // Estimate poses using ONNX Runtime Web + YOLOv8-Pose
          console.log(`[AI Insights] 🔬 Running pose estimation for ${participantId}...`);
          console.log(`[AI Insights] 🔬 Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
          const poses = await estimatePoses(detector, videoElement);
          console.log(`[AI Insights] 📊 Pose estimation result: ${poses?.length || 0} pose(s) detected for ${participantId}`);
          if (poses && poses.length > 0) {
            console.log(`[AI Insights] 📊 First pose confidence: ${poses[0].score}, keypoints: ${poses[0].keypoints?.length || 0}`);
          }

          if (!poses || poses.length === 0) {
            // No pose detected, skip processing
            console.log(`[AI Insights] ⚠️ No poses detected for ${participantId}, skipping`);
            return;
          }

          // Use the first (most confident) pose
          const pose = poses[0];
          if (!pose.keypoints || pose.keypoints.length === 0) {
            return;
          }

          // Process the pose data (keypoints are already in correct format)
          const keypoints = landmarksToKeypoints(pose.keypoints);
            const angles = calculateBiomechanicalAngles(keypoints);
            const metrics = calculateBiomechanicalMetrics(keypoints);

            // Update real-time display immediately (before DB save) - shared via context
            console.log(`[AI Insights] 📊 Updating real-time metrics for ${participantId}:`, {
              balance: metrics.balanceScore,
              symmetry: metrics.symmetryScore,
              postural: metrics.posturalEfficiency,
              angles: Object.keys(angles).filter(k => angles[k as keyof typeof angles] !== null).length
            })
            setRealtimeData(participantId, { angles, metrics })

            // Get or create pose data buffer for this participant
            if (!poseDataBufferRef.current.has(participantId)) {
              poseDataBufferRef.current.set(participantId, []);
            }

            const buffer = poseDataBufferRef.current.get(participantId)!;
            const sequenceNumber = buffer.length;
          const timestamp = sequenceNumber * 3; // Each pose is 3 seconds apart (since we process every 3 seconds)

          // Add pose data to buffer
            const poseData: PoseData = {
              timestamp,
              sequenceNumber,
              keypoints,
              angles,
              metrics,
            };

            buffer.push(poseData);

          // Limit buffer to 10 poses (30 seconds total - enough for 5-second analysis intervals)
          if (buffer.length > 10) {
              buffer.shift(); // Remove oldest pose
              // Adjust sequence numbers
              buffer.forEach((pose, idx) => {
                pose.sequenceNumber = idx;
              pose.timestamp = idx * 3; // Each pose is 3 seconds apart
            });
          }

          console.log(`[AI Insights] Collected pose data ${sequenceNumber + 1} for participant ${participantId} (${buffer.length}/10 poses)`);
          
          // Yield to browser after processing
          await new Promise(resolve => setTimeout(resolve, 0));
      } catch (error) {
          console.error(`[AI Insights] Error processing pose detection for ${participantId}:`, error);
        }
      } finally {
        (window as any).__poseDetectionProcessing = false;
      }
    }

    const analyzeMovementSequence = async () => {
      // Only analyze if room is connected
      if (!room || room.state !== ConnectionState.Connected) {
        console.log('[AI Insights] Room not connected, skipping analysis')
        return
      }

      const videoElementsCount = videoElementsRef.current.size
      console.log(`[AI Insights] Starting movement analysis - ${videoElementsCount} video elements, sessionOwnerId: ${sessionOwnerId}`)
      console.log(`[AI Insights] Video element participant IDs:`, Array.from(videoElementsRef.current.keys()))

      // Analyze each participant's collected pose data
      const participantsToAnalyze = Array.from(poseDataBufferRef.current.entries())
      console.log(`[AI Insights] 📊 Found ${participantsToAnalyze.length} participant(s) with pose data buffers`)
      console.log(`[AI Insights] 📋 Participants with pose data:`, participantsToAnalyze.map(([id, poses]) => ({ 
        id, 
        poseCount: poses.length,
        isCoach: id === sessionOwnerId,
        sessionType: sessionType
      })))
      console.log(`[AI Insights] 🎥 Video elements available:`, Array.from(videoElementsRef.current.keys()))
      console.log(`[AI Insights] 👥 All participants in room:`, Array.from(room.remoteParticipants.values()).map(p => ({ id: p.identity, name: p.name })))
      
      if (participantsToAnalyze.length === 0) {
        console.log(`[AI Insights] ⚠️ No participants with pose data to analyze`)
        return
      }

      for (const [participantId, poseDataArray] of participantsToAnalyze) {
        if (poseDataArray.length === 0) {
          console.log(`[AI Insights] ⚠️ No pose data collected for participant ${participantId}, skipping`)
          continue
        }

        // Filter out coach - only analyze subjects/participants (not the coach)
        const currentSessionOwnerId = sessionOwnerId
        const currentSessionType = sessionType
        console.log(`[AI Insights] 🔍 Checking participant ${participantId} for analysis - sessionOwnerId: ${currentSessionOwnerId}, sessionType: ${currentSessionType}, poseDataCount: ${poseDataArray.length}`)
        
        if (currentSessionOwnerId && participantId === currentSessionOwnerId && currentSessionType !== 'mocap') {
          console.log(`[AI Insights] ⏭️ Skipping coach (${participantId}) - only analyzing subjects/participants (not coach) for non-mocap sessions`)
          continue
        }

        console.log(`[AI Insights] ✅ Will analyze participant ${participantId} (${poseDataArray.length} pose data points)`)

        console.log(`[AI Insights] 🔬 Analyzing ${poseDataArray.length} pose data points for participant: ${participantId}`)

        // Use subject name from schedule if available, otherwise use participant name
        // Use refs to get latest values without causing re-renders
        const currentParticipantInfo = participantInfoRef.current
        const currentSubjectName = subjectNameRef.current
        const currentSubjectId = subjectIdRef.current
        const displayName = currentSubjectName || currentParticipantInfo[participantId]?.fullName || participantId
        
        // For mocap sessions: coach is in session pointing camera at athlete
        // Use subject_id as participantId so metrics are attributed to the athlete, not the coach
        // For other sessions: use subject_id if available, otherwise use LiveKit participantId
        const isMocapSession = sessionType === 'mocap'
        const metricParticipantId = (isMocapSession && currentSubjectId) ? currentSubjectId : (currentSubjectId || participantId)
        
        if (isMocapSession) {
          console.log(`[AI Insights] Mocap session: Analyzing coach's video feed (${participantId}) but attributing to subject (${metricParticipantId})`)
        }

        try {
          // Calculate average metrics from pose data
          const avgMetrics = poseDataArray.reduce((acc, pose) => {
            if (pose.metrics) {
              acc.balanceScore += pose.metrics.balanceScore
              acc.symmetryScore += pose.metrics.symmetryScore
              acc.posturalEfficiency += pose.metrics.posturalEfficiency
            }
            return acc
          }, { balanceScore: 0, symmetryScore: 0, posturalEfficiency: 0 })

          const count = poseDataArray.length
          const avgBalanceScore = count > 0 ? Math.round(avgMetrics.balanceScore / count) : 0
          const avgSymmetryScore = count > 0 ? Math.round(avgMetrics.symmetryScore / count) : 0
          const avgPosturalEfficiency = count > 0 ? Math.round(avgMetrics.posturalEfficiency / count) : 0

          // Send pose data for movement analysis
          const response = await fetch('/api/ai/analyze-movement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              poseData: poseDataArray.map(p => ({
                timestamp: p.timestamp,
                sequenceNumber: p.sequenceNumber,
                keypoints: p.keypoints,
                angles: p.angles,
                metrics: p.metrics,
              })),
              participantName: displayName,
              participantId,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.analysis) {
              // Only publish data if room is connected
              if (room.state === ConnectionState.Connected && room.localParticipant) {
                // Note: We don't publish insights via data channel anymore
                // Insights are only generated on-demand when clicking "Generate Session Insights"
              }

              // Extract metrics from analysis (we don't create insights here - only metrics)
              const currentSessionId = sessionIdRef.current
              const newMetric: AIMetric = {
                subject_id: metricParticipantId, // Partition key
                timestamp: data.analysis.timestamp || new Date().toISOString(), // Sort key
                session_id: currentSessionId || '',
                participant_id: metricParticipantId, // Same as subject_id
                participant_name: displayName,
                balance_score: data.analysis.balanceScore || 0,
                symmetry_score: data.analysis.symmetryScore || 0,
                postural_efficiency: data.analysis.posturalEfficiency,
                risk_level: data.analysis.riskLevel,
                posture_metrics: data.analysis.postureMetrics ? {
                  spine_lean: data.analysis.postureMetrics.spineLean,
                  neck_flexion: data.analysis.postureMetrics.neckFlexion,
                  shoulder_alignment: data.analysis.postureMetrics.shoulderAlignment,
                  pelvic_sway: data.analysis.postureMetrics.pelvicSway,
                  additional_metrics: data.analysis.postureMetrics.additionalMetrics,
                } : undefined,
                movement_quality: data.analysis.movementQuality,
                movement_patterns: data.analysis.movementPatterns,
                movement_consistency: data.analysis.movementConsistency,
                dynamic_stability: data.analysis.dynamicStability,
              }
              
              // Update local metrics state immediately for instant display (even if DB save fails)
              setMetrics((prev) => {
                const updated = [...prev, newMetric]
                // Don't save to localStorage - we fetch fresh data from API every 2 seconds
                return updated
              })
              
              // Update latest metrics immediately for instant display
              setLatestMetrics((prev) => {
                const updated = {
                ...prev,
                [metricParticipantId]: newMetric,
                }
                console.log(`[AI Insights] ✅ Updated latestMetrics for ${metricParticipantId}:`, {
                  balance: newMetric.balance_score,
                  symmetry: newMetric.symmetry_score,
                  postural: newMetric.postural_efficiency,
                  timestamp: newMetric.timestamp
                })
                // Force UI update
                setMetricsUpdateKey(prev => prev + 1)
                setMetricsTimestamp(new Date().toISOString())
                return updated
              })
              
              // Save METRIC to database (not full insight - just metrics)
              // This is done asynchronously - metrics are already displayed locally
              if (currentSessionId) {
                try {
                  const metricTimestamp = data.analysis.timestamp || new Date().toISOString()
                  console.log(`[AI Insights] 💾 Attempting to save metric to DynamoDB:`, {
                    sessionId: currentSessionId,
                    participantId: metricParticipantId,
                    participantName: displayName,
                    timestamp: metricTimestamp,
                    balance: data.analysis.balanceScore || 0,
                    symmetry: data.analysis.symmetryScore || 0,
                    postural: data.analysis.posturalEfficiency,
                  })
                  
                  const saveResponse = await fetch('/api/ai-insights/save-metric', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId: currentSessionId,
                      participantId: metricParticipantId,
                      participantName: displayName,
                      balanceScore: data.analysis.balanceScore || 0,
                      symmetryScore: data.analysis.symmetryScore || 0,
                      posturalEfficiency: data.analysis.posturalEfficiency,
                      riskLevel: data.analysis.riskLevel,
                      postureMetrics: data.analysis.postureMetrics,
                      movementQuality: data.analysis.movementQuality,
                      movementPatterns: data.analysis.movementPatterns,
                      movementConsistency: data.analysis.movementConsistency,
                      dynamicStability: data.analysis.dynamicStability,
                      timestamp: metricTimestamp,
                    }),
                  })
                  
                  if (saveResponse.ok) {
                    const saveData = await saveResponse.json()
                    console.log(`[AI Insights] Successfully saved metric to database for ${metricParticipantId}`, saveData)
                  } else {
                    // Try to parse error response
                    let errorData: any = {}
                    const contentType = saveResponse.headers.get('content-type')
                    const status = saveResponse.status
                    const statusText = saveResponse.statusText
                    
                    console.error(`[AI Insights] Save failed - Status: ${status} ${statusText}, Content-Type: ${contentType}`)
                    
                    try {
                      // Clone the response so we can read it multiple times
                      const responseClone = saveResponse.clone()
                      
                      if (contentType && contentType.includes('application/json')) {
                        try {
                          const jsonData = await responseClone.json()
                          errorData = jsonData
                          console.error(`[AI Insights] Error response (JSON):`, jsonData)
                          
                          // Log the actual error message if available
                          if (jsonData.error) {
                            console.error(`[AI Insights] Error message: ${jsonData.error}`)
                            if (jsonData.code) {
                              console.error(`[AI Insights] Error code: ${jsonData.code}`)
                            }
                          }
                        } catch (jsonError) {
                          console.error(`[AI Insights] Failed to parse JSON error response:`, jsonError)
                          // Try to get text instead
                          const text = await responseClone.text()
                          errorData = { 
                            message: text || `HTTP ${status} ${statusText}`,
                            rawText: text,
                            jsonParseError: jsonError instanceof Error ? jsonError.message : String(jsonError)
                          }
                          console.error(`[AI Insights] Error response (text):`, text || '(empty)')
                        }
                      } else {
                        const text = await responseClone.text()
                        errorData = { 
                          message: text || `HTTP ${status} ${statusText}`,
                          rawText: text || '(empty response body)'
                        }
                        console.error(`[AI Insights] Error response (text):`, text || '(empty)')
                      }
                    } catch (parseError) {
                      console.error(`[AI Insights] Failed to parse error response:`, parseError)
                      errorData = { 
                        message: `HTTP ${status} ${statusText}`,
                        parseError: parseError instanceof Error ? parseError.message : String(parseError),
                        stack: parseError instanceof Error ? parseError.stack : undefined
                      }
                    }
                    
                    // Log comprehensive error information
                    const errorMessage = errorData.error || errorData.message || `HTTP ${status} ${statusText}`
                    console.error(`[AI Insights] Failed to save metric for ${metricParticipantId}:`, {
                      status,
                      statusText,
                      contentType,
                      errorMessage,
                      errorDetails: errorData,
                      requestData: {
                        sessionId: currentSessionId,
                        participantId: metricParticipantId,
                        participantName: displayName
                      }
                    })
                    
                    // If it's a table not found error, log a helpful message
                    if (errorMessage.includes('does not exist') || errorData.code === 'ResourceNotFoundException') {
                      console.warn(`[AI Insights] DynamoDB table "jak-coach-session-ai-metrics" does not exist. Metrics are still being displayed locally and saved to localStorage. Please create the table to enable database persistence.`)
                    }
                  }
                } catch (saveError) {
                  console.error(`[AI Insights] Error saving insight to database:`, saveError)
                  // Don't block the UI if save fails
                }
              } else {
                console.warn(`[AI Insights] Cannot save insight - sessionId is missing`)
              }

              // Clear pose data buffer after successful analysis
              poseDataBufferRef.current.set(participantId, [])
              console.log(`[AI Insights] Cleared pose data buffer for ${participantId} after successful analysis`)
            } else {
              console.warn(`[AI Insights] Analysis response missing analysis data for ${participantId}`)
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error(`[AI Insights] Failed to analyze movement for ${participantId}:`, errorData)
            // Don't clear buffer on error - keep frames for next analysis
          }
        } catch (error) {
          console.error(`[AI Insights] Error analyzing movement sequence for ${participantId}:`, error)
          // Don't clear buffer on error - keep frames for next analysis
        }
      }
      
      console.log(`[AI Insights] Movement analysis cycle complete at ${new Date().toISOString()}`)
    }

    // Process pose detection every 3 seconds
    // Start immediately if video elements are ready, otherwise wait
    console.log('[AI Insights] Setting up pose detection interval (3 seconds)')
    console.log('[AI Insights] Video elements count:', videoElementsRef.current.size)
    
    // Start immediately if we have video elements, otherwise wait a bit
    const hasVideoElements = videoElementsRef.current.size > 0
    if (hasVideoElements) {
      console.log('[AI Insights] Video elements ready, starting pose detection immediately')
      processPoseDetection()
    } else {
      console.log('[AI Insights] Waiting for video elements, will start in 2 seconds')
      setTimeout(() => {
        console.log('[AI Insights] Starting pose detection after delay')
        processPoseDetection()
      }, 2000)
    }
    
    frameCollectionIntervalRef.current = setInterval(() => {
      processPoseDetection()
    }, 3000) // Every 3 seconds to reduce load
    
    // Set global flag for status checking
    ;(window as any).__poseDetectionSetup = true
    console.log('[AI Insights] ✅ Pose detection intervals set up')

    // Analyze collected pose data every 5 seconds for faster metric updates
    // Start analysis after 5 seconds (to collect at least 2-3 poses first), then repeat every 5 seconds
    console.log('[AI Insights] Setting up movement analysis interval (5 seconds) - will start after 5 seconds')
    
        // First analysis after 5 seconds
    firstAnalysisTimeoutRef.current = setTimeout(() => {
          console.log('[AI Insights] ⏰ Running first analysis after 5 seconds')
          console.log('[AI Insights] 📊 Pose data buffers:', Array.from(poseDataBufferRef.current.entries()).map(([id, poses]) => ({ id, count: poses.length })))
      analyzeMovementSequence()
      // Then set up recurring interval
          analysisIntervalRef.current = setInterval(() => {
            console.log('[AI Insights] ⏰ Recurring analysis triggered (every 5 seconds)')
            console.log('[AI Insights] 📊 Pose data buffers:', Array.from(poseDataBufferRef.current.entries()).map(([id, poses]) => ({ id, count: poses.length })))
            analyzeMovementSequence()
          }, 5000) // Analyze every 5 seconds for faster metric updates
        }, 5000) // Start first analysis after 5 seconds

    // Mark setup as complete
    setupCompleteRef.current = true

    return () => {
      console.log('[AI Insights] Cleaning up intervals')
      if (frameCollectionIntervalRef.current) {
        clearInterval(frameCollectionIntervalRef.current)
        frameCollectionIntervalRef.current = null
      }
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
        analysisIntervalRef.current = null
      }
      // Clear first analysis timeout if component unmounts before it runs
      if (firstAnalysisTimeoutRef.current) {
        clearTimeout(firstAnalysisTimeoutRef.current)
        firstAnalysisTimeoutRef.current = null
      }
      // Clear chat metrics interval
      if (chatMetricsIntervalRef.current) {
        clearInterval(chatMetricsIntervalRef.current)
        chatMetricsIntervalRef.current = null
      }
      // Clear pose data buffers on cleanup
      poseDataBufferRef.current.clear()
      // Clean up pose detectors (MediaPipe Pose doesn't need explicit cleanup)
      poseDetectorsRef.current.clear()
      // Reset setup flag so it can be set up again if needed
      setupCompleteRef.current = false
    }
  }, [room]) // Only depend on room - use refs for other values

  // Group insights by participant
  // For mocap sessions: insights are already attributed to subject_id, so don't filter by sessionOwnerId
  // For other sessions: filter out coach (sessionOwnerId)
  // Use participantName as the key to avoid duplicates when participantId differs (e.g., subject_id vs LiveKit ID)
  const insightsByParticipant = insights.reduce((acc, insight) => {
    const isMocapSession = sessionType === 'mocap'
    
    // For mocap sessions, insights are attributed to subject_id, so we don't need to filter
    // For other sessions, filter out coach (sessionOwnerId)
    if (!isMocapSession && sessionOwnerId && insight.participantId === sessionOwnerId) {
      console.log(`[AI Insights] Filtering out coach insight: participantId=${insight.participantId}, sessionOwnerId=${sessionOwnerId}`)
      return acc
    }
    
    // Use participantName as the key to group by actual participant, not just ID
    // This prevents duplicates when the same person has different participantIds
    const key = insight.participantName || insight.participantId
    
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(insight)
    return acc
  }, {} as Record<string, AIInsight[]>)
  
  // Sort insights within each group by timestamp (latest first) and keep only the latest one
  Object.keys(insightsByParticipant).forEach(key => {
    const group = insightsByParticipant[key]
    group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    // Keep only the latest insight per participant
    insightsByParticipant[key] = [group[0]]
  })
  
  // Debug logging
  if (sessionId) {
    console.log(`[AI Insights] Debug - Total insights: ${insights.length}, Filtered insights: ${Object.keys(insightsByParticipant).length}, sessionType: ${sessionType}, sessionOwnerId: ${sessionOwnerId}`)
    if (insights.length > 0 && Object.keys(insightsByParticipant).length === 0) {
      console.warn(`[AI Insights] All insights were filtered out! Insight participantIds:`, insights.map(i => i.participantId))
    }
  }

  // Get non-coach participant count
  const nonCoachParticipantCount = Object.keys(insightsByParticipant).length

  const handleGenerateInsights = async () => {
    if (!sessionId) {
      setExportMessage({ type: 'error', text: 'Session ID is required' })
      return
    }

    setIsGenerating(true)
    setExportMessage(null)

    try {
      const response = await fetch('/api/ai-insights/generate-from-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Convert generated insights to component format
        const generatedInsights: AIInsight[] = data.insights.map((item: any) => ({
          participantId: item.participantId,
          participantName: item.participantName,
          movementQuality: item.insight.movementQuality,
          movementPatterns: item.insight.movementPatterns,
          movementConsistency: item.insight.movementConsistency,
          dynamicStability: item.insight.dynamicStability,
          performanceInterpretation: item.insight.performanceInterpretation,
          performanceImpact: item.insight.performanceImpact,
          balanceScore: item.insight.balanceScore,
          symmetryScore: item.insight.symmetryScore,
          posturalEfficiency: item.insight.posturalEfficiency,
          riskLevel: item.insight.riskLevel,
          riskDescription: item.insight.riskDescription,
          targetedRecommendations: item.insight.targetedRecommendations,
          timestamp: new Date().toISOString(),
        }))

        console.log(`[AI Insights] 🤖 Generated ${generatedInsights.length} new insight(s) - updating state immediately`)
        console.log(`[AI Insights] 📊 Insight timestamps:`, generatedInsights.map(i => ({ participantId: i.participantId, timestamp: i.timestamp })))
        
        setInsights(generatedInsights)
        setShowInsights(true) // Show insights after generation
        
        // Insights are already saved to DynamoDB (jak-coach-session-ai-insights table) by the API
        console.log(`[AI Insights] ✅ Generated and saved ${generatedInsights.length} insight(s) to DynamoDB table: jak-coach-session-ai-insights`)
        console.log(`[AI Insights] 🔄 Next database fetch (in ~30 seconds) will pick up these new insights`)
        
        // DO NOT save to localStorage - database is the only source of truth
        // The periodic database fetch will update the UI with the latest insights
        
        setExportMessage({ 
          type: 'success', 
          text: `Successfully generated ${generatedInsights.length} insight(s)` 
        })
        setTimeout(() => setExportMessage(null), 5000)
      } else {
        const contentType = response.headers.get('content-type')
        let errorMessage = `Failed to generate insights (${response.status})`
        
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } else {
            const text = await response.text()
            console.error('[AI Insights] Error response (non-JSON):', text.substring(0, 200))
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }
        } catch (parseError) {
          console.error('[AI Insights] Error parsing error response:', parseError)
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        
        setExportMessage({ 
          type: 'error', 
          text: errorMessage
        })
      }
    } catch (error: any) {
      console.error('[AI Insights] Error generating insights:', error)
      setExportMessage({ 
        type: 'error', 
        text: error.message || 'Failed to generate insights. Please try again.' 
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportSummary = async () => {
    if (!sessionId) {
      setExportMessage({ type: 'error', text: 'Session ID is required' })
      return
    }

    setIsExporting(true)
    setExportMessage(null)

    try {
      // Step 1: Generate and save summary to DB (fast, no PDF generation)
      const response = await fetch('/api/ai-insights/export-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (response.ok) {
        const data = await response.json()
        setExportMessage({ 
          type: 'success', 
          text: `Summary generated successfully. Downloading PDF...` 
        })

        // Step 2: Download PDF (generated on-demand)
        try {
          const pdfResponse = await fetch(`/api/ai-insights/download-pdf/${sessionId}`, {
            method: 'GET',
          })

          if (pdfResponse.ok) {
            const contentType = pdfResponse.headers.get('content-type')
            if (contentType && contentType.includes('application/pdf')) {
              // Download PDF
              const blob = await pdfResponse.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `ai-insights-summary-${sessionId}-${Date.now()}.pdf`
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
              
              setExportMessage({ 
                type: 'success', 
                text: 'Summary generated and PDF downloaded successfully' 
              })
            } else {
              setExportMessage({ 
                type: 'error', 
                text: 'Failed to download PDF - invalid response format' 
              })
            }
          } else {
            const contentType = pdfResponse.headers.get('content-type')
            let errorMessage = `Failed to download PDF (${pdfResponse.status})`
            
            try {
              if (contentType && contentType.includes('application/json')) {
                const errorData = await pdfResponse.json()
                errorMessage = errorData.error || errorMessage
              } else {
                const text = await pdfResponse.text()
                console.error('[AI Insights] PDF download error response (non-JSON):', text.substring(0, 200))
                errorMessage = `Server error (${pdfResponse.status}): ${pdfResponse.statusText}`
              }
            } catch (parseError) {
              console.error('[AI Insights] Error parsing PDF download error response:', parseError)
              errorMessage = `Server error (${pdfResponse.status}): ${pdfResponse.statusText}`
            }
            
            setExportMessage({ 
              type: 'error', 
              text: errorMessage
            })
          }
        } catch (pdfError: any) {
          console.error('[AI Insights] Error downloading PDF:', pdfError)
          setExportMessage({ 
            type: 'error', 
            text: `Summary generated but PDF download failed: ${pdfError.message || 'Unknown error'}` 
          })
        }
        // Clear message after 5 seconds
        setTimeout(() => setExportMessage(null), 5000)
      } else {
        // Handle error response - check content type first
        const contentType = response.headers.get('content-type')
        let errorMessage = `Failed to export summary (${response.status})`
        
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } else {
            // Response might be HTML error page
            const text = await response.text()
            console.error('[AI Insights] Error response (non-JSON):', text.substring(0, 200))
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }
        } catch (parseError) {
          console.error('[AI Insights] Error parsing error response:', parseError)
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        
        setExportMessage({ 
          type: 'error', 
          text: errorMessage
        })
      }
    } catch (error: any) {
      console.error('[AI Insights] Error exporting summary:', error)
      setExportMessage({ 
        type: 'error', 
        text: error.message || 'Failed to export summary. Please try again.' 
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 pb-2 flex-shrink-0 border-b">
        <h3 className="font-semibold text-sm whitespace-nowrap mb-4">Real-Time Movement Analysis</h3>
        
        {exportMessage && (
          <Alert variant={exportMessage.type === 'error' ? 'destructive' : 'default'} className="mb-4">
            <AlertDescription>{exportMessage.text}</AlertDescription>
          </Alert>
        )}
      </div>
      
      <Tabs defaultValue="insights" className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="px-4 pt-2 flex-shrink-0 border-b">
          <TabsList className="grid w-full grid-cols-2 relative">
            <TabsTrigger value="insights">Movement Insights</TabsTrigger>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-px bg-border" />
            <TabsTrigger value="report">Session Report</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="insights" className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 mt-0 p-4" style={{ height: 0 }}>
          <div className="space-y-4">
              {(() => {
                // Helper functions for insight display
                const getRiskColor = (riskLevel?: string) => {
                  if (!riskLevel) return 'bg-gray-500'
                  const level = riskLevel.toLowerCase()
                  if (level === 'high') return 'bg-red-500'
                  if (level === 'moderate') return 'bg-yellow-500'
                  return 'bg-green-500'
                }

                const getRiskEmoji = (riskLevel?: string) => {
                  if (!riskLevel) return '⚪'
                  const level = riskLevel.toLowerCase()
                  if (level === 'high') return '🔴'
                  if (level === 'moderate') return '🟡'
                  return '🟢'
                }

                // Function to render a single insight card
                const renderInsightCard = (participantId: string, participantInsights: AIInsight[]) => {
                  const latestInsight = participantInsights[participantInsights.length - 1]
                  const participantName = latestInsight.participantName

                  return (
                    <div className="space-y-4 min-w-0">
                      {/* Movement Quality & Patterns */}
                      {(latestInsight.movementQuality || (latestInsight.movementPatterns && Array.isArray(latestInsight.movementPatterns) && latestInsight.movementPatterns.length > 0)) && (
                        <div className="space-y-2">
                          <h5 className="font-semibold text-sm">Movement Analysis</h5>
                          {latestInsight.movementQuality && (
                            <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere">
                              <span className="font-medium">Movement Quality:</span> {latestInsight.movementQuality}
                            </p>
                          )}
                          {latestInsight.movementPatterns && Array.isArray(latestInsight.movementPatterns) && latestInsight.movementPatterns.length > 0 && (
                            <div className="space-y-1 min-w-0">
                              <p className="text-sm font-medium text-muted-foreground">Movement Patterns:</p>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                {latestInsight.movementPatterns.map((pattern, idx) => (
                                  <li key={idx} className="flex items-start gap-2 min-w-0">
                                    <span className="text-primary mt-0.5 shrink-0">•</span>
                                    <span className="break-words overflow-wrap-anywhere">{pattern}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Posture Metrics */}
                      {latestInsight.postureMetrics && (
                        <div className="space-y-2 min-w-0">
                          <h5 className="font-semibold text-sm">Posture Metrics</h5>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {latestInsight.postureMetrics.spineLean && (
                              <p className="break-words overflow-wrap-anywhere">
                                <span className="font-medium">Spine Lean:</span> {latestInsight.postureMetrics.spineLean}
                              </p>
                            )}
                            {latestInsight.postureMetrics.neckFlexion && (
                              <p className="break-words overflow-wrap-anywhere">
                                <span className="font-medium">Neck Flexion:</span> {latestInsight.postureMetrics.neckFlexion}
                              </p>
                            )}
                            {latestInsight.postureMetrics.shoulderAlignment && (
                              <p className="break-words overflow-wrap-anywhere">
                                <span className="font-medium">Shoulder Alignment:</span> {latestInsight.postureMetrics.shoulderAlignment}
                              </p>
                            )}
                            {latestInsight.postureMetrics.pelvicSway && (
                              <p className="break-words overflow-wrap-anywhere">
                                <span className="font-medium">Pelvic Sway:</span> {latestInsight.postureMetrics.pelvicSway}
                              </p>
                            )}
                            {latestInsight.postureMetrics.additionalMetrics?.map((metric, idx) => (
                              <p key={idx} className="break-words overflow-wrap-anywhere">{metric}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Performance Interpretation */}
                      {latestInsight.performanceInterpretation && (
                        <div className="space-y-2 min-w-0">
                          <h5 className="font-semibold text-sm">Performance Interpretation</h5>
                          <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere">
                            {latestInsight.performanceInterpretation}
                          </p>
                        </div>
                      )}

                      {/* Performance Impact */}
                      {latestInsight.performanceImpact && latestInsight.performanceImpact.length > 0 && (
                        <div className="space-y-2 min-w-0">
                          <h5 className="font-semibold text-sm">Performance Impact</h5>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {latestInsight.performanceImpact.map((impact, idx) => (
                              <li key={idx} className="flex items-start gap-2 min-w-0">
                                <span className="text-destructive mt-0.5 shrink-0">•</span>
                                <span className="break-words overflow-wrap-anywhere">{impact}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Scores */}
                      {(latestInsight.balanceScore > 0 || latestInsight.symmetryScore > 0 || latestInsight.posturalEfficiency || latestInsight.movementConsistency || latestInsight.dynamicStability) && (
                        <div className="space-y-2">
                          <h5 className="font-semibold text-sm">Scores</h5>
                          <div className="flex flex-wrap gap-4 text-sm">
                            {latestInsight.balanceScore > 0 && (
                              <div>
                                <span className="text-muted-foreground">Balance Score: </span>
                                <span className="font-semibold">{latestInsight.balanceScore}</span>
                              </div>
                            )}
                            {latestInsight.symmetryScore > 0 && (
                              <div>
                                <span className="text-muted-foreground">Symmetry: </span>
                                <span className="font-semibold">{latestInsight.symmetryScore}</span>
                              </div>
                            )}
                            {latestInsight.posturalEfficiency && (
                              <div>
                                <span className="text-muted-foreground">Postural Efficiency: </span>
                                <span className="font-semibold">{latestInsight.posturalEfficiency}</span>
                              </div>
                            )}
                            {latestInsight.movementConsistency !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Movement Consistency: </span>
                                <span className="font-semibold">{latestInsight.movementConsistency}</span>
                              </div>
                            )}
                            {latestInsight.dynamicStability !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Dynamic Stability: </span>
                                <span className="font-semibold">{latestInsight.dynamicStability}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Risk Level */}
                      {latestInsight.riskLevel && (
                        <div className="space-y-2 min-w-0">
                          <h5 className="font-semibold text-sm">Risk Level</h5>
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-lg shrink-0">{getRiskEmoji(latestInsight.riskLevel)}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold text-white shrink-0 ${getRiskColor(latestInsight.riskLevel)}`}>
                              {latestInsight.riskLevel}
                            </span>
                            {latestInsight.riskDescription && (
                              <span className="text-sm text-muted-foreground break-words overflow-wrap-anywhere">{latestInsight.riskDescription}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Targeted Recommendations */}
                      {latestInsight.targetedRecommendations && latestInsight.targetedRecommendations.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border min-w-0">
                          <h5 className="font-semibold text-sm">Targeted Recommendations</h5>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {latestInsight.targetedRecommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2 min-w-0">
                                <span className="text-primary mt-0.5 shrink-0">•</span>
                                <span className="break-words overflow-wrap-anywhere">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                }

                // Show insights if they exist
                if (showInsights && insights.length > 0 && Object.keys(insightsByParticipant).length > 0) {
                  return (
                    <div className="space-y-4">
                      {/* If only 1 participant (not counting coach), show single card */}
                      {nonCoachParticipantCount === 1 ? (
                        <div className="space-y-4">
                          {Object.entries(insightsByParticipant).map(([participantId, participantInsights]) => {
                            const latestInsight = participantInsights[participantInsights.length - 1]
                            const participantName = latestInsight.participantName

                            return (
                              <Card key={participantId} className="p-4 min-w-0 overflow-x-auto">
                                <div className="space-y-4 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 min-w-0">
                                    <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
                                    <h4 className="font-semibold text-base truncate min-w-0">🔥 AI Movement Summary – {participantName}</h4>
                                  </div>
                                  {renderInsightCard(participantId, participantInsights)}
                                </div>
                              </Card>
                            )
                          })}
                        </div>
                      ) : (
                        // If more than 1 participant, use accordion
                        <Accordion type="single" collapsible className="w-full">
                          {Object.entries(insightsByParticipant).map(([participantId, participantInsights]) => {
                            const latestInsight = participantInsights[participantInsights.length - 1]
                            const participantName = latestInsight.participantName
                            
                            return (
                              <AccordionItem key={participantId} value={participantId} className="border-border">
                                <AccordionTrigger className="hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
                                    <span className="font-semibold">🔥 AI Movement Summary – {participantName}</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <Card className="p-4 min-w-0 overflow-x-auto">
                                    {renderInsightCard(participantId, participantInsights)}
                                  </Card>
                                </AccordionContent>
                              </AccordionItem>
                            )
                          })}
                        </Accordion>
                      )}
                    </div>
                  )
                } else {
                  // No insights - show Generate Session Insights button
                  return (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground text-center py-8">
                        <Lightbulb className="h-8 w-8 mx-auto mb-4 opacity-50" />
                        <p className="mb-4">No insights generated yet</p>
                        <p className="text-xs mb-6">Generate comprehensive AI insights from collected metrics</p>
                        <Button
                          onClick={handleGenerateInsights}
                          disabled={isGenerating || !sessionId || metrics.length === 0}
                          size="lg"
                          variant="outline"
                          className="flex items-center gap-2 mx-auto"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              <span className="truncate">Generating...</span>
                            </>
                          ) : (
                            <>
                              <Lightbulb className="h-4 w-4 shrink-0" />
                              <span className="truncate">Generate Session Insights</span>
                            </>
                          )}
                        </Button>
                        {metrics.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-4">
                            Metrics are being collected. Please wait for metrics to be available.
                          </p>
                        )}
                      </div>
                    </div>
                  )
                }
              })()}
          </div>
        </TabsContent>

        <TabsContent value="report" className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 mt-0 p-4 flex flex-col items-center justify-center">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground mb-6">
                  Export a comprehensive PDF summary of the session
                </p>
                <Button
                  onClick={handleExportSummary}
                  disabled={isExporting || !sessionId || insights.length === 0}
                  size="lg"
                  variant="outline"
                  className="min-w-[200px]"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="truncate">Exporting...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 mr-2" />
                      <span className="truncate">Export Session Summary</span>
                    </>
                  )}
                </Button>
                {insights.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Generate insights first to export a summary
                  </p>
                )}
              </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

