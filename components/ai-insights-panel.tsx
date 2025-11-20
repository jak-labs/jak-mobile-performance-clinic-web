"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Lightbulb } from "lucide-react"
import { useRoomContext, useTracks } from "@livekit/components-react"
import { DataPacket_Kind, Track } from "livekit-client"

interface AIInsight {
  participantId: string
  participantName: string
  exerciseName?: string
  balanceScore: number
  symmetryScore: number
  insights: string
  recommendations: string
  timestamp: string
}

interface AIInsightsPanelProps {
  participants: Array<{ identity: string; name?: string }>
  participantInfo: Record<string, { firstName: string; lastName: string; fullName: string }>
}

export function AIInsightsPanel({ participants, participantInfo }: AIInsightsPanelProps) {
  const room = useRoomContext()
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
  const [insights, setInsights] = useState<AIInsight[]>([])
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())

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
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Analyze each participant's video
      for (const [participantId, videoElement] of videoElementsRef.current.entries()) {
        if (!videoElement || videoElement.readyState < 2) continue

        try {
          canvas.width = videoElement.videoWidth || 640
          canvas.height = videoElement.videoHeight || 480

          if (canvas.width === 0 || canvas.height === 0) continue

          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

          // Convert to base64
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

          // Get participant name
          const info = participantInfo[participantId]
          const participantName = info?.fullName || participantId

          // Send for analysis
          const response = await fetch('/api/ai/analyze-movement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64,
              participantName,
              participantId,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.analysis) {
              // Send insight via data channel (for other participants to see)
              const message = JSON.stringify({
                type: 'ai-insight',
                participantId,
                participantName,
                ...data.analysis,
              })

              room.localParticipant.publishData(
                new TextEncoder().encode(message),
                DataPacket_Kind.RELIABLE
              )

              // Also update local state
              const newInsight: AIInsight = {
                participantId,
                participantName,
                balanceScore: data.analysis.balanceScore,
                symmetryScore: data.analysis.symmetryScore,
                insights: data.analysis.insights,
                recommendations: data.analysis.recommendations,
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
          console.error(`Error analyzing frame for ${participantId}:`, error)
        }
      }
    }

    // Analyze frames every 15 seconds (to reduce API calls)
    analysisIntervalRef.current = setInterval(analyzeFrames, 15000)

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
      }
    }
  }, [room, participantInfo, tracks])

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
          <p className="text-xs mt-2">Analysis runs every 15 seconds</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(insightsByParticipant).map(([participantId, participantInsights]) => {
            const latestInsight = participantInsights[participantInsights.length - 1]
            const participantName = latestInsight.participantName

            return (
              <Card key={participantId} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    <h4 className="font-semibold text-sm">{participantName}</h4>
                  </div>

                  {latestInsight.exerciseName && (
                    <h5 className="font-medium text-base text-gray-900 dark:text-gray-100">
                      {latestInsight.exerciseName}
                    </h5>
                  )}

                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-3 w-3 text-yellow-500" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        AI Summary
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {latestInsight.insights}
                    </p>
                  </div>

                  {latestInsight.balanceScore > 0 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Balance Score: <span className="font-semibold">{latestInsight.balanceScore}</span>
                      {latestInsight.symmetryScore > 0 && (
                        <>
                          {' • '}
                          Symmetry: <span className="font-semibold">{latestInsight.symmetryScore}</span>
                        </>
                      )}
                    </div>
                  )}

                  {latestInsight.recommendations && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-semibold">Recommendations:</span> {latestInsight.recommendations}
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

