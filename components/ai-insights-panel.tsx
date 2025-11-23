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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
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

  // Capture video frames and send for analysis periodically
  useEffect(() => {
    if (!room || !canvasRef.current) return

    const analyzeFrames = async () => {
      // Only analyze if room is connected
      if (!room || room.state !== ConnectionState.Connected) {
        console.log('[AI Insights] Room not connected, skipping analysis')
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

      const videoElementsCount = videoElementsRef.current.size
      console.log(`[AI Insights] Starting analysis - ${videoElementsCount} video elements, sessionOwnerId: ${sessionOwnerId}`)

      // Analyze each participant's video (analyze whoever is in session - for mocap, subject is not in session)
      for (const [participantId, videoElement] of videoElementsRef.current.entries()) {
        if (!videoElement || videoElement.readyState < 2) continue

        console.log(`[AI Insights] Analyzing participant: ${participantId}`)

        try {
          canvas.width = videoElement.videoWidth || 640
          canvas.height = videoElement.videoHeight || 480

          if (canvas.width === 0 || canvas.height === 0) continue

          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

          // Convert to base64
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

          // Use subject name from schedule if available, otherwise use participant name
          const displayName = subjectName || participantInfo[participantId]?.fullName || participantId

          // Send for analysis
          const response = await fetch('/api/ai/analyze-movement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64,
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
                // Add new insight and keep last 50 total (increased from 20 to accommodate saved insights)
                const updated = [...filtered, newInsight].slice(-50)
                // Save to localStorage whenever insights are updated
                saveInsightsToStorage(updated)
                return updated
              })

              // Save insight to database
              if (sessionId) {
                try {
                  console.log(`[AI Insights] Attempting to save insight for sessionId: ${sessionId}, participantId: ${participantId}`)
                  const saveResponse = await fetch('/api/ai-insights/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId,
                      participantId,
                      participantName: displayName,
                      exerciseName: newInsight.exerciseName,
                      postureMetrics: newInsight.postureMetrics,
                      performanceInterpretation: newInsight.performanceInterpretation,
                      performanceImpact: newInsight.performanceImpact,
                      balanceScore: newInsight.balanceScore,
                      symmetryScore: newInsight.symmetryScore,
                      posturalEfficiency: newInsight.posturalEfficiency,
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
            }
          }
        } catch (error) {
          console.error(`[AI Insights] Error analyzing frame for ${participantId}:`, error)
        }
      }
      
      console.log(`[AI Insights] Analysis cycle complete`)
    }

    // Analyze frames every 30 seconds to limit LLM API calls
    console.log('[AI Insights] Setting up analysis interval (30 seconds)')
    analyzeFrames() // Run once immediately
    analysisIntervalRef.current = setInterval(analyzeFrames, 30000)

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
      }
    }
  }, [room, participantInfo, tracks, subjectName, sessionId])

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
          <p className="text-xs mt-2">Analysis runs every 30 seconds</p>
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
                  {(latestInsight.balanceScore > 0 || latestInsight.symmetryScore > 0 || latestInsight.posturalEfficiency) && (
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

