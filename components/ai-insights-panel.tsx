"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, Download, Loader2 } from "lucide-react"
import { useRoomContext, useTracks } from "@livekit/components-react"
import { DataPacket_Kind, Track, ConnectionState } from "livekit-client"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
}

export function AIInsightsPanel({ participants, participantInfo, sessionOwnerId, sessionId }: AIInsightsPanelProps) {
  const room = useRoomContext()
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
  const [insights, setInsights] = useState<AIInsight[]>([])
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameCollectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const firstAnalysisTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  // Frame buffer: Map<participantId, Array<{imageBase64: string, timestamp: number, sequenceNumber: number}>>
  const framesBufferRef = useRef<Map<string, Array<{ imageBase64: string; timestamp: number; sequenceNumber: number }>>>(new Map())
  const setupCompleteRef = useRef(false) // Track if intervals have been set up
  const [subjectName, setSubjectName] = useState<string | null>(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
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
        const subjectId = session.subject_id || (session.subject_ids && session.subject_ids[0])

        if (!subjectId) {
          console.log('[AI Insights] No subject_id found in session')
          return
        }

        // Fetch subject name
        const subjectResponse = await fetch(`/api/subjects/${subjectId}`)
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
                     subjectId

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
          // Don't set loading state - we have cached data to show
          return
        }
      }
    } catch (error) {
      console.error('[AI Insights] Error loading from localStorage:', error)
    }
    
    // Only show loading if we don't have cached data
    setIsLoadingInsights(true)
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

  useEffect(() => {
    subjectNameRef.current = subjectName
  }, [subjectName])

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

      // Analyze each participant's collected frames
      const participantsToAnalyze = Array.from(framesBufferRef.current.entries())
      console.log(`[AI Insights] Found ${participantsToAnalyze.length} participant(s) with frame buffers`)
      
      if (participantsToAnalyze.length === 0) {
        console.log(`[AI Insights] No participants with frames to analyze`)
        return
      }

      for (const [participantId, frames] of participantsToAnalyze) {
        if (frames.length === 0) {
          console.log(`[AI Insights] No frames collected for participant ${participantId}, skipping`)
          continue
        }

        console.log(`[AI Insights] Analyzing ${frames.length} frames for participant: ${participantId} (will analyze even if less than 10 frames)`)

        // Use subject name from schedule if available, otherwise use participant name
        // Use refs to get latest values without causing re-renders
        const currentParticipantInfo = participantInfoRef.current
        const currentSubjectName = subjectNameRef.current
        const displayName = currentSubjectName || currentParticipantInfo[participantId]?.fullName || participantId

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
                try {
                  // Send insight via data channel (for other participants to see)
                  const message = JSON.stringify({
                    type: 'ai-insight',
                    participantId,
                    participantName: displayName,
                    ...data.analysis,
                  })

                  room.localParticipant.publishData(
                    new TextEncoder().encode(message),
                    { reliable: true }
                  )
                } catch (error) {
                  console.error('Error publishing data:', error)
                  // Continue to update local state even if publish fails
                }
              }

              // Also update local state
              const newInsight: AIInsight = {
                participantId,
                participantName: displayName,
                postureMetrics: data.analysis.postureMetrics,
                movementQuality: data.analysis.movementQuality,
                movementPatterns: data.analysis.movementPatterns,
                movementConsistency: data.analysis.movementConsistency,
                dynamicStability: data.analysis.dynamicStability,
                performanceInterpretation: data.analysis.performanceInterpretation,
                performanceImpact: data.analysis.performanceImpact,
                balanceScore: data.analysis.balanceScore || 0,
                symmetryScore: data.analysis.symmetryScore || 0,
                posturalEfficiency: data.analysis.posturalEfficiency,
                riskLevel: data.analysis.riskLevel,
                riskDescription: data.analysis.riskDescription,
                targetedRecommendations: data.analysis.targetedRecommendations,
                timestamp: data.analysis.timestamp,
              }

              setInsights((prev) => {
                // Remove any existing insights for this participant (keep only latest)
                const filtered = prev.filter(
                  (i) => i.participantId !== newInsight.participantId
                )
                // Add new insight and keep last 50 total
                const updated = [...filtered, newInsight].slice(-50)
                console.log(`[AI Insights] Updated insights for ${participantId} at ${new Date().toISOString()}. Total insights: ${updated.length}`)
                // Save to localStorage whenever insights are updated (use ref to get latest function)
                saveInsightsToStorageRef.current(updated)
                return updated
              })

              // Save insight to database
              const currentSessionId = sessionIdRef.current
              if (currentSessionId) {
                try {
                  console.log(`[AI Insights] Attempting to save insight for sessionId: ${currentSessionId}, participantId: ${participantId}`)
                  const saveResponse = await fetch('/api/ai-insights/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId: currentSessionId,
                      participantId,
                      participantName: displayName,
                      exerciseName: newInsight.exerciseName,
                      postureMetrics: newInsight.postureMetrics,
                      performanceInterpretation: newInsight.performanceInterpretation,
                      performanceImpact: newInsight.performanceImpact,
                      balanceScore: newInsight.balanceScore,
                      symmetryScore: newInsight.symmetryScore,
                      posturalEfficiency: newInsight.posturalEfficiency,
                      movementQuality: newInsight.movementQuality,
                      movementPatterns: newInsight.movementPatterns,
                      movementConsistency: newInsight.movementConsistency,
                      dynamicStability: newInsight.dynamicStability,
                      riskLevel: newInsight.riskLevel,
                      riskDescription: newInsight.riskDescription,
                      targetedRecommendations: newInsight.targetedRecommendations,
                      timestamp: newInsight.timestamp,
                    }),
                  })
                  
                  if (saveResponse.ok) {
                    const saveData = await saveResponse.json()
                    console.log(`[AI Insights] Successfully saved insight to database for ${participantId}`, saveData)
                  } else {
                    // Try to parse error response
                    let errorData = {}
                    const contentType = saveResponse.headers.get('content-type')
                    try {
                      if (contentType && contentType.includes('application/json')) {
                        errorData = await saveResponse.json()
                      } else {
                        const text = await saveResponse.text()
                        errorData = { message: text || `HTTP ${saveResponse.status} ${saveResponse.statusText}` }
                      }
                    } catch (parseError) {
                      errorData = { 
                        message: `HTTP ${saveResponse.status} ${saveResponse.statusText}`,
                        parseError: parseError instanceof Error ? parseError.message : String(parseError)
                      }
                    }
                    console.error(`[AI Insights] Failed to save insight:`, {
                      status: saveResponse.status,
                      statusText: saveResponse.statusText,
                      error: errorData
                    })
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
  const insightsByParticipant = insights.reduce((acc, insight) => {
    if (!acc[insight.participantId]) {
      acc[insight.participantId] = []
    }
    acc[insight.participantId].push(insight)
    return acc
  }, {} as Record<string, AIInsight[]>)

  const handleExportSummary = async () => {
    if (!sessionId) {
      setExportMessage({ type: 'error', text: 'Session ID is required' })
      return
    }

    setIsExporting(true)
    setExportMessage(null)

    try {
      const response = await fetch('/api/ai-insights/export-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (response.ok) {
        // Check if response is PDF
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/pdf')) {
          // Download PDF
          const blob = await response.blob()
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
            text: 'Summary regenerated and PDF downloaded successfully' 
          })
        } else {
          // JSON response (shouldn't happen, but handle it)
          const data = await response.json()
          setExportMessage({ 
            type: 'success', 
            text: `Successfully exported ${data.summaries?.length || 0} summary(ies)` 
          })
        }
        // Clear message after 5 seconds
        setTimeout(() => setExportMessage(null), 5000)
      } else {
        const errorData = await response.json()
        setExportMessage({ 
          type: 'error', 
          text: errorData.error || 'Failed to export summary' 
        })
      }
    } catch (error: any) {
      console.error('[AI Insights] Error exporting summary:', error)
      setExportMessage({ 
        type: 'error', 
        text: error.message || 'Failed to export summary' 
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">AI Movement Analysis</h3>
          <Button
            onClick={handleExportSummary}
            disabled={isExporting || !sessionId || insights.length === 0}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Export Session Summary</span>
              </>
            )}
          </Button>
        </div>

        {exportMessage && (
          <Alert variant={exportMessage.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{exportMessage.text}</AlertDescription>
          </Alert>
        )}
      
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {isLoadingInsights ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
          <p>Loading AI insights...</p>
        </div>
      ) : Object.keys(insightsByParticipant).length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>AI insights will appear here as participants move</p>
          <p className="text-xs mt-2">Movement analysis runs every 30 seconds (10 frames over 30s)</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(insightsByParticipant).map(([participantId, participantInsights]) => {
            const latestInsight = participantInsights[participantInsights.length - 1]
            const participantName = latestInsight.participantName

            // Get risk level color
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

            return (
              <Card key={participantId} className="p-4">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    <h4 className="font-semibold text-base">🔥 AI Movement Summary – {participantName}</h4>
                  </div>

                  {latestInsight.exerciseName && (
                    <h5 className="font-medium text-sm text-muted-foreground">
                      {latestInsight.exerciseName}
                    </h5>
                  )}

                  {/* Movement Quality & Patterns (for multi-frame analysis) */}
                  {(latestInsight.movementQuality || (latestInsight.movementPatterns && latestInsight.movementPatterns.length > 0)) && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Movement Analysis</h5>
                      {latestInsight.movementQuality && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Movement Quality:</span> {latestInsight.movementQuality}
                        </p>
                      )}
                      {latestInsight.movementPatterns && latestInsight.movementPatterns.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Movement Patterns:</p>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {latestInsight.movementPatterns.map((pattern, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{pattern}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Posture Metrics */}
                  {latestInsight.postureMetrics && Object.keys(latestInsight.postureMetrics).length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Posture Metrics</h5>
                      <div className="space-y-1 text-sm">
                        {latestInsight.postureMetrics.spineLean && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">Spine Lean:</span> {latestInsight.postureMetrics.spineLean}
                          </p>
                        )}
                        {latestInsight.postureMetrics.neckFlexion && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">Neck Flexion:</span> {latestInsight.postureMetrics.neckFlexion}
                          </p>
                        )}
                        {latestInsight.postureMetrics.shoulderAlignment && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">Shoulder Alignment:</span> {latestInsight.postureMetrics.shoulderAlignment}
                          </p>
                        )}
                        {latestInsight.postureMetrics.pelvicSway && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">Pelvic Sway:</span> {latestInsight.postureMetrics.pelvicSway}
                          </p>
                        )}
                        {latestInsight.postureMetrics.additionalMetrics?.map((metric, idx) => (
                          <p key={idx} className="text-muted-foreground">{metric}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Performance Interpretation */}
                  {latestInsight.performanceInterpretation && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Performance Interpretation</h5>
                      <p className="text-sm text-muted-foreground">
                        {latestInsight.performanceInterpretation}
                      </p>
                    </div>
                  )}

                  {/* Performance Impact */}
                  {latestInsight.performanceImpact && latestInsight.performanceImpact.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Performance Impact</h5>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {latestInsight.performanceImpact.map((impact, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-destructive mt-0.5">•</span>
                            <span>{impact}</span>
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
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Risk Level</h5>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getRiskEmoji(latestInsight.riskLevel)}</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getRiskColor(latestInsight.riskLevel)}`}>
                          {latestInsight.riskLevel}
                        </span>
                        {latestInsight.riskDescription && (
                          <span className="text-sm text-muted-foreground">{latestInsight.riskDescription}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Targeted Recommendations */}
                  {latestInsight.targetedRecommendations && latestInsight.targetedRecommendations.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <h5 className="font-semibold text-sm">Targeted Recommendations</h5>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {latestInsight.targetedRecommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

