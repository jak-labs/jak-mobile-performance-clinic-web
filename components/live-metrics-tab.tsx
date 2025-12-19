"use client"

import { Card } from "@/components/ui/card"
import { Activity, AlertCircle } from "lucide-react"
import type { BiomechanicalAngles, BiomechanicalMetrics } from "@/lib/pose-detection"
import { useRealtimeMetrics } from "@/lib/realtime-metrics-context"
import { useEffect, useState } from "react"

interface LiveMetricsTabProps {
  participants: Array<{ identity: string; name: string }>
  participantInfo: Record<string, { fullName?: string }>
}

export function LiveMetricsTab({ participants, participantInfo }: LiveMetricsTabProps) {
  const { realtimeData } = useRealtimeMetrics()
  const [statusMessage, setStatusMessage] = useState<string>("Initializing pose detection...")

  // Check status periodically with detailed logging
  useEffect(() => {
    const checkStatus = () => {
      const poseDetectionSetup = (window as any).__poseDetectionSetup
      const aiInsightsPanelRendered = (window as any).__aiInsightsPanelRendered
      const hiddenVideos = Array.from(document.querySelectorAll('video')).filter(v => 
        v.style.display === 'none' && v.parentElement === document.body
      )
      const allVideos = Array.from(document.querySelectorAll('video'))
      const hasValidVideo = hiddenVideos.some(v => v.videoWidth > 0 && v.videoHeight > 0)
      const status = (window as any).__poseDetectionStatus
      const realtimeDataKeys = Object.keys(realtimeData)
      
      // Build detailed status message
      let message = ""
      let details: string[] = []
      
      // Log to terminal (server console) - this will show in npm run dev terminal
      console.log('\n=== [Live Metrics] Status Check ===')
      console.log(`[Live Metrics] Timestamp: ${new Date().toISOString()}`)
      console.log(`[Live Metrics] Participants: ${participants.length}`)
      console.log(`[Live Metrics] Participants with metrics: ${participants.filter(p => realtimeData[p.identity]?.angles || realtimeData[p.identity]?.metrics).length}`)
      console.log(`[Live Metrics] Realtime data keys: ${realtimeDataKeys.length} (${realtimeDataKeys.join(', ') || 'none'})`)
      
      if (!aiInsightsPanelRendered) {
        message = "AI Insights Panel not rendered..."
        details.push("⚠️ AI Insights Panel rendered: false")
        console.log(`[Live Metrics] ⚠️ AI Insights Panel not rendered - this is the problem!`)
      } else {
        details.push("✓ AI Insights Panel rendered: true")
        console.log(`[Live Metrics] ✓ AI Insights Panel is rendered`)
      }
      
      if (!poseDetectionSetup) {
        message = "Waiting for pose detection setup..."
        details.push("⚠️ Setup flag: false")
        console.log(`[Live Metrics] ⚠️ Pose detection setup flag is FALSE`)
        console.log(`[Live Metrics]   This means the setup useEffect in AIInsightsPanel hasn't run or failed`)
      } else {
        details.push("✓ Setup flag: true")
        console.log(`[Live Metrics] ✓ Pose detection setup flag is TRUE`)
        
        if (hiddenVideos.length === 0) {
          message = "Waiting for video elements..."
          details.push(`⚠️ Hidden video elements: 0 (total videos: ${allVideos.length})`)
          console.log(`[Live Metrics] ⚠️ No hidden video elements found`)
          console.log(`[Live Metrics]   Total videos on page: ${allVideos.length}`)
          allVideos.forEach((v, i) => {
            console.log(`[Live Metrics]   Video ${i}: display=${v.style.display}, parent=${v.parentElement?.tagName}, dimensions=${v.videoWidth}x${v.videoHeight}`)
          })
        } else {
          details.push(`✓ Hidden video elements: ${hiddenVideos.length}`)
          console.log(`[Live Metrics] ✓ Found ${hiddenVideos.length} hidden video elements`)
          
          if (!hasValidVideo) {
            message = "Waiting for video stream..."
            details.push("⚠️ Valid video: false")
            console.log(`[Live Metrics] ⚠️ No valid video streams (all have 0 dimensions)`)
            hiddenVideos.forEach((v, i) => {
              console.log(`[Live Metrics]   Video ${i}: ${v.videoWidth}x${v.videoHeight} (readyState: ${v.readyState}, paused: ${v.paused})`)
            })
          } else {
            details.push("✓ Valid video: true")
            console.log(`[Live Metrics] ✓ Valid video streams found`)
            
            if (status === 'no_video_elements') {
              message = "No video elements available"
              console.log(`[Live Metrics] ⚠️ Status: no_video_elements`)
            } else if (status === 'processing') {
              message = "Detecting pose..."
              details.push("Status: processing")
              console.log(`[Live Metrics] ✓ Status: processing (pose detection is running)`)
            } else {
              message = "Ready - waiting for pose detection..."
              details.push(`Status: ${status || 'unknown'}`)
              console.log(`[Live Metrics] Status: ${status || 'unknown'}`)
            }
          }
        }
      }
      
      // Log realtime data details
      if (realtimeDataKeys.length > 0) {
        console.log(`[Live Metrics] ✓ Realtime data available for: ${realtimeDataKeys.join(', ')}`)
        realtimeDataKeys.forEach(key => {
          const data = realtimeData[key]
          console.log(`[Live Metrics]   ${key}: angles=${!!data.angles}, metrics=${!!data.metrics}`)
          if (data.metrics) {
            console.log(`[Live Metrics]     Balance: ${data.metrics.balanceScore}, Symmetry: ${data.metrics.symmetryScore}`)
          }
        })
      } else {
        console.log(`[Live Metrics] ⚠️ No realtime data available yet`)
      }
      
      console.log('=== End Status Check ===\n')
      
      setStatusMessage(message)
    }

    checkStatus()
    const interval = setInterval(checkStatus, 2000)
    return () => clearInterval(interval)
  }, [realtimeData, participants])

  const formatAngle = (angle: number | null) => {
    if (angle === null) return "N/A"
    return `${Math.round(angle)}°`
  }

  const formatScore = (score: number) => {
    return `${Math.round(score)}`
  }

  // Filter out participants that don't have metrics yet
  const participantsWithMetrics = participants.filter(p => 
    realtimeData[p.identity]?.angles || realtimeData[p.identity]?.metrics
  )

  // Show loading state if no metrics available
  if (participantsWithMetrics.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="bg-black/80 backdrop-blur-sm border-white/20 p-6 max-w-md w-full">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-sm text-white/80 font-medium">{statusMessage}</span>
          </div>
          <div className="text-xs text-white/50 space-y-1">
            <div>Status details logged to terminal (npm run dev console)</div>
            <div>Participants: {participants.length}</div>
            <div>Participants with metrics: {participantsWithMetrics.length}</div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">Live Movement Metrics</h3>
        <p className="text-sm text-white/60">Real-time biomechanical analysis for all participants</p>
      </div>

      {participantsWithMetrics.map((participant) => {
        const data = realtimeData[participant.identity]
        const angles = data?.angles || null
        const metrics = data?.metrics || null
        const participantName = participantInfo[participant.identity]?.fullName || participant.name || participant.identity

        return (
          <Card key={participant.identity} className="bg-black/80 backdrop-blur-sm border-white/20 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-primary" />
              <h4 className="text-base font-semibold text-white">{participantName}</h4>
            </div>

            {/* Scores */}
            {metrics && (
              <div className="mb-4 space-y-3">
                <h5 className="text-sm font-medium text-white/80 mb-2">Performance Scores</h5>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Balance</div>
                    <div className="text-white font-bold text-lg">{formatScore(metrics.balanceScore)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Symmetry</div>
                    <div className="text-white font-bold text-lg">{formatScore(metrics.symmetryScore)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Postural</div>
                    <div className="text-white font-bold text-lg">{formatScore(metrics.posturalEfficiency)}</div>
                  </div>
                </div>
                {metrics.centerOfMass && (
                  <div className="text-xs text-white/60 mt-2">
                    Center of Mass: ({metrics.centerOfMass.x.toFixed(2)}, {metrics.centerOfMass.y.toFixed(2)})
                  </div>
                )}
              </div>
            )}

            {/* Angles */}
            {angles && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-white/80 mb-2">Joint Angles</h5>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Left Knee</div>
                    <div className="text-white font-semibold">{formatAngle(angles.leftKnee)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Right Knee</div>
                    <div className="text-white font-semibold">{formatAngle(angles.rightKnee)}</div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Left Hip</div>
                    <div className="text-white font-semibold">{formatAngle(angles.leftHip)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Right Hip</div>
                    <div className="text-white font-semibold">{formatAngle(angles.rightHip)}</div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Left Shoulder</div>
                    <div className="text-white font-semibold">{formatAngle(angles.leftShoulder)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Right Shoulder</div>
                    <div className="text-white font-semibold">{formatAngle(angles.rightShoulder)}</div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Left Elbow</div>
                    <div className="text-white font-semibold">{formatAngle(angles.leftElbow)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Right Elbow</div>
                    <div className="text-white font-semibold">{formatAngle(angles.rightElbow)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Spine Lean</div>
                    <div className="text-white font-semibold">{formatAngle(angles.spineLean)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Neck Flexion</div>
                    <div className="text-white font-semibold">{formatAngle(angles.neckFlexion)}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

