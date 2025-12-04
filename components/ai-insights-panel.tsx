"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, Download, Loader2 } from "lucide-react"
import { useRoomContext, useTracks } from "@livekit/components-react"
import { DataPacket_Kind, Track, ConnectionState } from "livekit-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

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
}

export function AIInsightsPanel({ participants, participantInfo, sessionOwnerId, sessionId, sessionType }: AIInsightsPanelProps) {
  const room = useRoomContext()
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
  const [insights, setInsights] = useState<AIInsight[]>([]) // Generated insights (single per participant) - only shown after clicking "Generate Session Insights"
  const [metrics, setMetrics] = useState<AIMetric[]>([]) // Real-time metrics
  const [latestMetrics, setLatestMetrics] = useState<Record<string, AIMetric>>({}) // Latest metric per participant
  const [showInsights, setShowInsights] = useState(false) // Flag to control whether to show insights or metrics
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameCollectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const firstAnalysisTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  // Frame buffer: Map<participantId, Array<{imageBase64: string, timestamp: number, sequenceNumber: number}>>
  const framesBufferRef = useRef<Map<string, Array<{ imageBase64: string; timestamp: number; sequenceNumber: number }>>>(new Map())
  const setupCompleteRef = useRef(false) // Track if intervals have been set up
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

  // Helper function to get localStorage key for this session
  const getStorageKey = () => `ai-insights-${sessionId}`

  // Helper function to save insights to localStorage
  const saveInsightsToStorage = (insightsToSave: AIInsight[]) => {
    if (!sessionId) return
    try {
      const storageKey = getStorageKey()
      localStorage.setItem(storageKey, JSON.stringify({
        insights: insightsToSave,
        timestamp: new Date().toISOString(),
      }))
      console.log(`[AI Insights] Saved ${insightsToSave.length} insights to localStorage`)
    } catch (error) {
      console.error('[AI Insights] Error saving to localStorage:', error)
    }
  }

  // Helper function to load insights from localStorage
  const loadInsightsFromStorage = (): AIInsight[] | null => {
    if (!sessionId) return null
    try {
      const storageKey = getStorageKey()
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        console.log(`[AI Insights] Loaded ${data.insights?.length || 0} insights from localStorage`)
        return data.insights || null
      }
    } catch (error) {
      console.error('[AI Insights] Error loading from localStorage:', error)
    }
    return null
  }

  // Use refs for values that change frequently to avoid re-running useEffect
  const participantInfoRef = useRef(participantInfo)
  const subjectNameRef = useRef(subjectName)
  const sessionIdRef = useRef(sessionId)
  const saveInsightsToStorageRef = useRef(saveInsightsToStorage)

  // Reset loaded flag when sessionId changes
  useEffect(() => {
    insightsLoadedRef.current = false
  }, [sessionId])

  // Load insights from localStorage immediately on mount or sessionId change
  // This ensures instant display when switching tabs
  useEffect(() => {
    if (!sessionId) {
      setInsights([])
      setShowInsights(false)
      return
    }
    
    try {
      const storageKey = `ai-insights-${sessionId}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        const cachedInsights = data.insights || []
        if (cachedInsights && cachedInsights.length > 0) {
          console.log(`[AI Insights] Loading ${cachedInsights.length} cached insights from localStorage`)
          setInsights(cachedInsights)
          
          // Also load showInsights flag
          try {
            const flagKey = `ai-insights-show-flag-${sessionId}`
            const flagStored = localStorage.getItem(flagKey)
            if (flagStored) {
              const flagData = JSON.parse(flagStored)
              setShowInsights(flagData.showInsights === true)
            } else {
              // If insights exist but no flag, assume they should be shown
              setShowInsights(true)
            }
          } catch (flagError) {
            console.error('[AI Insights] Error loading showInsights flag:', flagError)
            // If insights exist, show them anyway
            setShowInsights(true)
          }
          
          // Don't set loading state - we have cached data to show
          return
        }
      }
      
      // No cached insights - check if showInsights flag exists (shouldn't, but just in case)
      try {
        const flagKey = `ai-insights-show-flag-${sessionId}`
        const flagStored = localStorage.getItem(flagKey)
        if (flagStored) {
          const flagData = JSON.parse(flagStored)
          setShowInsights(flagData.showInsights === true)
        }
      } catch (flagError) {
        // Ignore flag errors if no insights exist
      }
    } catch (error) {
      console.error('[AI Insights] Error loading from localStorage:', error)
    }
    
    // Only show loading if we don't have cached data
    setIsLoadingInsights(true)
  }, [sessionId])

  // Load metrics from localStorage on mount
  useEffect(() => {
    if (!sessionId) return
    
    try {
      const storageKey = `ai-metrics-${sessionId}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const storedMetrics = JSON.parse(stored)
        setMetrics(storedMetrics.metrics || [])
        
        // Update latest metrics per participant
        const latest: Record<string, AIMetric> = {}
        storedMetrics.metrics?.forEach((metric: AIMetric) => {
          const pid = metric.participant_id
          if (!latest[pid] || new Date(metric.timestamp) > new Date(latest[pid].timestamp)) {
            latest[pid] = metric
          }
        })
        setLatestMetrics(latest)
        console.log(`[AI Insights] Loaded ${storedMetrics.metrics?.length || 0} metrics from localStorage`)
      }
    } catch (error) {
      console.error('[AI Insights] Error loading metrics from localStorage:', error)
    }
  }, [sessionId])

  // Fetch metrics periodically to display real-time data
  useEffect(() => {
    if (!sessionId) return

    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/ai-insights/metrics/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          const fetchedMetrics = data.metrics || []
          setMetrics(fetchedMetrics)
          
          // Update latest metrics per participant
          const latest: Record<string, AIMetric> = {}
          fetchedMetrics.forEach((metric: AIMetric) => {
            const pid = metric.participant_id
            if (!latest[pid] || new Date(metric.timestamp) > new Date(latest[pid].timestamp)) {
              latest[pid] = metric
            }
          })
          setLatestMetrics(latest)
          
          // Save to localStorage for instant display
          try {
            const storageKey = `ai-metrics-${sessionId}`
            localStorage.setItem(storageKey, JSON.stringify({
              metrics: fetchedMetrics,
              lastUpdated: new Date().toISOString(),
            }))
          } catch (storageError) {
            console.error('[AI Insights] Error saving metrics to localStorage:', storageError)
          }
        }
      } catch (error) {
        console.error('[AI Insights] Error fetching metrics:', error)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5000) // Fetch every 5 seconds

    return () => clearInterval(interval)
  }, [sessionId])

  // Fetch saved AI insights from database when sessionId is available
  // This runs in background and updates insights if database has newer/more data
  useEffect(() => {
    if (!sessionId || insightsLoadedRef.current) return

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
          
          // Always update with database insights (they're the source of truth)
          // Merge with existing insights - keep the latest per participant
          setInsights((prev) => {
            // If we have database insights, use them (they're more complete)
            if (convertedInsights.length > 0) {
              // Create a map of insights by participantId, prioritizing database insights
              const insightMap = new Map<string, AIInsight>()
              
              // First add database insights (source of truth)
              convertedInsights.forEach(insight => {
                insightMap.set(insight.participantId, insight)
              })
              
              // Then add any cached insights that aren't in database (in case of race condition)
              prev.forEach(insight => {
                if (!insightMap.has(insight.participantId)) {
                  insightMap.set(insight.participantId, insight)
                }
              })
              
              const merged = Array.from(insightMap.values())
              // Sort by timestamp descending
              merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              
              // Save to localStorage
              saveInsightsToStorage(merged)
              return merged
            } else {
              // If database is empty, keep existing insights (from cache)
              console.log('[AI Insights] Database empty, keeping existing insights')
              return prev
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

    // Fetch in background - don't block UI
    fetchSavedInsights()
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
            // Save to localStorage whenever insights are updated
            saveInsightsToStorage(updated)
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

  // Set up video elements for frame capture
  useEffect(() => {
    if (!room || !canvasRef.current) return

    // Create video elements for each track
    tracks.forEach((trackRef) => {
      if (!trackRef.participant || !trackRef.publication?.track) return
      
      const participantId = trackRef.participant.identity
      if (videoElementsRef.current.has(participantId)) return

      const videoElement = document.createElement('video')
      videoElement.autoplay = true
      videoElement.playsInline = true
      videoElement.style.display = 'none'
      document.body.appendChild(videoElement)

      const mediaStream = new MediaStream([trackRef.publication.track.mediaStreamTrack])
      videoElement.srcObject = mediaStream
      videoElement.play().catch(console.error)

      videoElementsRef.current.set(participantId, videoElement)
    })

    return () => {
      // Cleanup video elements
      videoElementsRef.current.forEach((video) => {
        video.srcObject = null
        document.body.removeChild(video)
      })
      videoElementsRef.current.clear()
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
    saveInsightsToStorageRef.current = saveInsightsToStorage
  }, [saveInsightsToStorage])

  // Collect frames every 3 seconds and analyze every 30 seconds
  // Only set up once when room and canvas are available
  useEffect(() => {
    if (!room || !canvasRef.current) {
      console.log('[AI Insights] Skipping setup - room or canvas not available', { hasRoom: !!room, hasCanvas: !!canvasRef.current })
      return
    }

    // Only set up intervals once
    if (setupCompleteRef.current) {
      console.log('[AI Insights] Intervals already set up, skipping')
      return
    }

    console.log('[AI Insights] Setting up intervals for the first time')

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

    const collectFrame = () => {
      // Only collect if room is connected
      if (!room || room.state !== ConnectionState.Connected) {
        console.log('[AI Insights] Room not connected, skipping frame collection')
        return
      }

      const canvas = canvasRef.current
      if (!canvas) {
        console.log('[AI Insights] Canvas not available')
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.log('[AI Insights] Canvas context not available')
        return
      }

      // Collect frames from each participant's video
      for (const [participantId, videoElement] of videoElementsRef.current.entries()) {
        if (!videoElement || videoElement.readyState < 2) continue

        try {
          canvas.width = videoElement.videoWidth || 640
          canvas.height = videoElement.videoHeight || 480

          if (canvas.width === 0 || canvas.height === 0) continue

          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

          // Convert to base64 with reduced quality (0.6) to manage token usage
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]

          // Get or create frame buffer for this participant
          if (!framesBufferRef.current.has(participantId)) {
            framesBufferRef.current.set(participantId, [])
          }

          const buffer = framesBufferRef.current.get(participantId)!
          const sequenceNumber = buffer.length
          const timestamp = sequenceNumber * 3 // Each frame is 3 seconds apart

          // Add frame to buffer (keep max 10 frames)
          buffer.push({
            imageBase64,
            timestamp,
            sequenceNumber,
          })

          // Limit buffer to 10 frames (30 seconds total)
          if (buffer.length > 10) {
            buffer.shift() // Remove oldest frame
            // Adjust sequence numbers
            buffer.forEach((frame, idx) => {
              frame.sequenceNumber = idx
              frame.timestamp = idx * 3
            })
          }

          console.log(`[AI Insights] Collected frame ${sequenceNumber + 1} for participant ${participantId} (${buffer.length}/10 frames)`)
        } catch (error) {
          console.error(`[AI Insights] Error collecting frame for ${participantId}:`, error)
        }
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

      // Analyze each participant's collected frames
      const participantsToAnalyze = Array.from(framesBufferRef.current.entries())
      console.log(`[AI Insights] Found ${participantsToAnalyze.length} participant(s) with frame buffers`)
      console.log(`[AI Insights] Participants with frames:`, participantsToAnalyze.map(([id, frames]) => ({ id, frameCount: frames.length })))
      
      if (participantsToAnalyze.length === 0) {
        console.log(`[AI Insights] No participants with frames to analyze`)
        return
      }

      for (const [participantId, frames] of participantsToAnalyze) {
        if (frames.length === 0) {
          console.log(`[AI Insights] No frames collected for participant ${participantId}, skipping`)
          continue
        }

        // Filter out coach - only analyze subjects/participants (not the coach)
        const currentSessionOwnerId = sessionOwnerId
        const currentSessionType = sessionType
        if (currentSessionOwnerId && participantId === currentSessionOwnerId && currentSessionType !== 'mocap') {
          console.log(`[AI Insights] Skipping coach (${participantId}) - only analyzing subjects`)
          continue
        }

        console.log(`[AI Insights] Analyzing ${frames.length} frames for participant: ${participantId} (will analyze even if less than 10 frames)`)

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
          // Send frames for movement analysis
          const response = await fetch('/api/ai/analyze-movement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              frames: frames.map(f => ({
                imageBase64: f.imageBase64,
                timestamp: f.timestamp,
                sequenceNumber: f.sequenceNumber,
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
              }
              
              // Update local metrics state immediately for instant display (even if DB save fails)
              setMetrics((prev) => {
                const updated = [...prev, newMetric]
                // Save to localStorage for instant display on next load
                try {
                  const storageKey = `ai-metrics-${currentSessionId}`
                  localStorage.setItem(storageKey, JSON.stringify({
                    metrics: updated,
                    lastUpdated: new Date().toISOString(),
                  }))
                } catch (storageError) {
                  console.error('[AI Insights] Error saving metrics to localStorage:', storageError)
                }
                return updated
              })
              
              setLatestMetrics((prev) => ({
                ...prev,
                [metricParticipantId]: newMetric,
              }))
              
              // Save METRIC to database (not full insight - just metrics)
              // This is done asynchronously - metrics are already displayed locally
              if (currentSessionId) {
                try {
                  console.log(`[AI Insights] Attempting to save metric for sessionId: ${currentSessionId}, participantId: ${metricParticipantId} (LiveKit: ${participantId})`)
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
                      timestamp: data.analysis.timestamp || new Date().toISOString(),
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

              // Clear frame buffer after successful analysis
              framesBufferRef.current.set(participantId, [])
              console.log(`[AI Insights] Cleared frame buffer for ${participantId} after successful analysis`)
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

    // Collect frames every 3 seconds
    console.log('[AI Insights] Setting up frame collection interval (3 seconds)')
    collectFrame() // Collect first frame immediately
    frameCollectionIntervalRef.current = setInterval(collectFrame, 3000)

    // Analyze collected frames every 30 seconds
    // Start analysis after 30 seconds (to collect 10 frames first), then repeat every 30 seconds
    console.log('[AI Insights] Setting up movement analysis interval (30 seconds) - will start after 30 seconds')
    
    // First analysis after 30 seconds
    firstAnalysisTimeoutRef.current = setTimeout(() => {
      console.log('[AI Insights] Running first analysis after 30 seconds')
      analyzeMovementSequence()
      // Then set up recurring interval
      analysisIntervalRef.current = setInterval(analyzeMovementSequence, 30000)
    }, 30000)

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
      // Clear frame buffers on cleanup
      framesBufferRef.current.clear()
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

        setInsights(generatedInsights)
        setShowInsights(true) // Show insights after generation
        
        // Save insights to localStorage for persistence across tab switches
        saveInsightsToStorage(generatedInsights)
        
        // Also save showInsights flag to localStorage
        try {
          const storageKey = `ai-insights-show-flag-${sessionId}`
          localStorage.setItem(storageKey, JSON.stringify({ showInsights: true }))
        } catch (error) {
          console.error('[AI Insights] Error saving showInsights flag to localStorage:', error)
        }
        
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
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="p-4 pb-2 flex-shrink-0">
          <h3 className="font-semibold text-sm whitespace-nowrap mb-4">AI Movement Analysis</h3>
          
          {exportMessage && (
            <Alert variant={exportMessage.type === 'error' ? 'destructive' : 'default'} className="mb-4">
              <AlertDescription>{exportMessage.text}</AlertDescription>
            </Alert>
          )}
          
          <Tabs defaultValue="metrics" className="w-full flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 relative flex-shrink-0">
              <TabsTrigger value="metrics">Real-time Metrics</TabsTrigger>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-px bg-border" />
              <TabsTrigger value="insights">AI Insights</TabsTrigger>
            </TabsList>
            
            <TabsContent value="metrics" className="mt-4 flex-1 overflow-y-auto scrollbar-hide min-w-0">
              <div className="space-y-4">
              {isLoadingInsights ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
                  <p>Loading metrics...</p>
                </div>
              ) : (() => {
                // Show metrics
                if (Object.keys(latestMetrics).length > 0) {
                  const metricsByParticipant = Object.entries(latestMetrics).reduce((acc, [pid, metric]) => {
                    // Filter out coach if needed
                    if (sessionOwnerId && pid === sessionOwnerId && sessionType !== 'mocap') {
                      return acc
                    }
                    if (!acc[pid]) {
                      acc[pid] = []
                    }
                    acc[pid].push(metric)
                    return acc
                  }, {} as Record<string, AIMetric[]>)

                  const participantEntries = Object.entries(metricsByParticipant)
                  
                  if (participantEntries.length === 0) {
                    return (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Metrics will appear here as participants move</p>
                        <p className="text-xs mt-2">Metrics are collected every 30 seconds</p>
                      </div>
                    )
                  }

                  // Render metrics display
                  const renderMetricsCard = (participantId: string, participantMetrics: AIMetric[]) => {
                    const latestMetric = participantMetrics[participantMetrics.length - 1]
                    const participantName = latestMetric.participant_name

                    return (
                      <Card className="p-5 min-w-0 bg-card border-border">
                        <div className="space-y-5 min-w-0">
                          <div className="flex items-center gap-2 mb-3 min-w-0">
                            <h4 className="font-bold text-lg text-foreground truncate min-w-0">Real-time Metrics – {participantName}</h4>
                          </div>

                          {/* Scores */}
                          <div className="space-y-3">
                            <h5 className="font-bold text-base text-foreground">Scores</h5>
                            <div className="flex flex-wrap gap-6">
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground mb-1">Balance Score</span>
                                <span className="text-2xl font-bold text-foreground">{latestMetric.balance_score}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground mb-1">Symmetry</span>
                                <span className="text-2xl font-bold text-foreground">{latestMetric.symmetry_score}</span>
                              </div>
                              {latestMetric.postural_efficiency && (
                                <div className="flex flex-col">
                                  <span className="text-sm text-muted-foreground mb-1">Postural Efficiency</span>
                                  <span className="text-2xl font-bold text-foreground">{latestMetric.postural_efficiency}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Risk Level */}
                          {latestMetric.risk_level && (
                            <div className="space-y-2 min-w-0">
                              <h5 className="font-bold text-base text-foreground">Risk Level</h5>
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span className={`px-3 py-1.5 rounded-md text-sm font-bold text-white shrink-0 ${
                                  latestMetric.risk_level.toLowerCase() === 'high' ? 'bg-red-500' :
                                  latestMetric.risk_level.toLowerCase() === 'moderate' ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}>
                                  {latestMetric.risk_level}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Posture Metrics */}
                          {latestMetric.posture_metrics && (
                            <div className="space-y-3 min-w-0">
                              <h5 className="font-bold text-base text-foreground">Posture Metrics</h5>
                              <div className="space-y-2.5 text-base">
                                {latestMetric.posture_metrics.spine_lean && (
                                  <p className="break-words overflow-wrap-anywhere text-foreground">
                                    <span className="font-semibold text-foreground">Spine Lean:</span> <span className="text-muted-foreground">{latestMetric.posture_metrics.spine_lean}</span>
                                  </p>
                                )}
                                {latestMetric.posture_metrics.neck_flexion && (
                                  <p className="break-words overflow-wrap-anywhere text-foreground">
                                    <span className="font-semibold text-foreground">Neck Flexion:</span> <span className="text-muted-foreground">{latestMetric.posture_metrics.neck_flexion}</span>
                                  </p>
                                )}
                                {latestMetric.posture_metrics.shoulder_alignment && (
                                  <p className="break-words overflow-wrap-anywhere text-foreground">
                                    <span className="font-semibold text-foreground">Shoulder Alignment:</span> <span className="text-muted-foreground">{latestMetric.posture_metrics.shoulder_alignment}</span>
                                  </p>
                                )}
                                {latestMetric.posture_metrics.pelvic_sway && (
                                  <p className="break-words overflow-wrap-anywhere text-foreground">
                                    <span className="font-semibold text-foreground">Pelvic Sway:</span> <span className="text-muted-foreground">{latestMetric.posture_metrics.pelvic_sway}</span>
                                  </p>
                                )}
                                {latestMetric.posture_metrics.additional_metrics?.map((metric, idx) => (
                                  <p key={idx} className="break-words overflow-wrap-anywhere text-foreground">{metric}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-sm text-muted-foreground pt-2 border-t border-border">
                            Last updated: <span className="font-medium text-foreground">{new Date(latestMetric.timestamp).toLocaleTimeString()}</span>
                          </p>
                        </div>
                      </Card>
                    )
                  }

                  // Single participant
                  if (participantEntries.length === 1) {
                    const [participantId, participantMetrics] = participantEntries[0]
                    return (
                      <div className="space-y-4">
                        {renderMetricsCard(participantId, participantMetrics)}
                      </div>
                    )
                  }

                  // Multiple participants - use accordion
                  return (
                    <Accordion type="single" collapsible className="w-full">
                      {participantEntries.map(([participantId, participantMetrics]) => {
                        const latestMetric = participantMetrics[participantMetrics.length - 1]
                        const participantName = latestMetric.participant_name
                        
                        return (
                          <AccordionItem key={participantId} value={participantId} className="border-border">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{participantName}</span>
                                <span className="text-xs text-muted-foreground">
                                  (Balance: {latestMetric.balance_score}, Symmetry: {latestMetric.symmetry_score})
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              {renderMetricsCard(participantId, participantMetrics)}
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  )
                } else {
                  // No metrics
                  return (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Metrics will appear here as participants move</p>
                      <p className="text-xs mt-2">Metrics are collected every 30 seconds</p>
                    </div>
                  )
                }
              })()}
              </div>
            </TabsContent>
            
            <TabsContent value="insights" className="mt-4 flex-1 overflow-y-auto scrollbar-hide min-w-0">
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
                      {(latestInsight.movementQuality || (latestInsight.movementPatterns && latestInsight.movementPatterns.length > 0)) && (
                        <div className="space-y-2">
                          <h5 className="font-semibold text-sm">Movement Analysis</h5>
                          {latestInsight.movementQuality && (
                            <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere">
                              <span className="font-medium">Movement Quality:</span> {latestInsight.movementQuality}
                            </p>
                          )}
                          {latestInsight.movementPatterns && latestInsight.movementPatterns.length > 0 && (
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
                      <div className="flex flex-col sm:flex-row gap-2 justify-end">
                        <Button
                          onClick={handleExportSummary}
                          disabled={isExporting || !sessionId || insights.length === 0}
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-2 w-full sm:w-auto min-w-0 shrink-0"
                        >
                          {isExporting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              <span className="truncate">Exporting...</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 shrink-0" />
                              <span className="truncate">Export Session Summary</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* If only 1 participant (not counting coach), show single card */}
                      {nonCoachParticipantCount === 1 ? (
                        <div className="space-y-4">
                          {Object.entries(insightsByParticipant).map(([participantId, participantInsights]) => {
                            const latestInsight = participantInsights[participantInsights.length - 1]
                            const participantName = latestInsight.participantName

                            return (
                              <Card key={participantId} className="p-4 min-w-0">
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
                                  <Card className="p-4 min-w-0">
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
          </Tabs>
        </div>
      </div>
    </div>
  )
}

