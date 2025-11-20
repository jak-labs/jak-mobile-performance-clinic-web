"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Lightbulb } from "lucide-react"
import { useRoomContext, useTracks } from "@livekit/components-react"
import { DataPacket_Kind, Track, ConnectionState } from "livekit-client"

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

  // Listen for data channel messages from AI agent
  useEffect(() => {
    if (!room) return

    const handleDataReceived = (payload: Uint8Array, kind: DataPacket_Kind, participant?: any) => {
      try {
        const decoder = new TextDecoder()
        const message = JSON.parse(decoder.decode(payload))
        
        if (message.type === 'ai-insight') {
          const newInsight: AIInsight = {
            participantId: message.participantId,
            participantName: message.participantName || message.participantId,
            exerciseName: message.exerciseName,
            balanceScore: message.balanceScore || 0,
            symmetryScore: message.symmetryScore || 0,
            insights: message.insights || '',
            recommendations: message.recommendations || '',
            timestamp: message.timestamp || new Date().toISOString(),
          }

          // Update insights - keep only the latest per participant/exercise
          setInsights((prev) => {
            const filtered = prev.filter(
              (i) => !(i.participantId === newInsight.participantId && i.exerciseName === newInsight.exerciseName)
            )
            return [...filtered, newInsight].slice(-20) // Keep last 20 insights total
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
                    DataPacket_Kind.RELIABLE
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
                const filtered = prev.filter(
                  (i) => i.participantId !== newInsight.participantId
                )
                return [...filtered, newInsight].slice(-20)
              })
            }
          }
        } catch (error) {
          console.error(`[AI Insights] Error analyzing frame for ${participantId}:`, error)
        }
      }
      
      console.log(`[AI Insights] Analysis cycle complete`)
    }

    // Analyze frames every 5 seconds
    console.log('[AI Insights] Setting up analysis interval')
    analyzeFrames() // Run once immediately
    analysisIntervalRef.current = setInterval(analyzeFrames, 5000)

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
      }
    }
  }, [room, participantInfo, tracks, subjectName])

  // Group insights by participant
  const insightsByParticipant = insights.reduce((acc, insight) => {
    if (!acc[insight.participantId]) {
      acc[insight.participantId] = []
    }
    acc[insight.participantId].push(insight)
    return acc
  }, {} as Record<string, AIInsight[]>)

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide">
      <h3 className="font-semibold text-sm mb-4">AI Movement Analysis</h3>
      
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {Object.keys(insightsByParticipant).length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>AI insights will appear here as participants move</p>
          <p className="text-xs mt-2">Analysis runs every 5 seconds</p>
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
  )
}

