"use client"

import { Card } from "@/components/ui/card"
import { Activity, AlertCircle } from "lucide-react"
import type { BiomechanicalAngles, BiomechanicalMetrics } from "@/lib/pose-detection"
import { useEffect, useState } from "react"

interface RealtimeMetricsDisplayProps {
  participantId: string
  participantName: string
  angles: BiomechanicalAngles | null
  metrics: BiomechanicalMetrics | null
  isCoach?: boolean // Whether the current viewer is a coach
}

export function RealtimeMetricsDisplay({ 
  participantId, 
  participantName, 
  angles, 
  metrics,
  isCoach = false
}: RealtimeMetricsDisplayProps) {
  const [statusMessage, setStatusMessage] = useState<string>("Initializing pose detection...")
  const [showError, setShowError] = useState(false)

  // Check status periodically
  useEffect(() => {
    const checkStatus = () => {
      // Pose detection runs for both coach and participants
      // Participants can see their own metrics in real-time
      
      // Check if pose detection is set up
      const poseDetectionSetup = (window as any).__poseDetectionSetup
      if (!poseDetectionSetup) {
        setStatusMessage("Waiting for pose detection setup...")
        return
      }

      // Check if video elements exist in the hidden video elements (used for pose detection)
      // These are created by AIInsightsPanel and added to document.body
      const hiddenVideos = Array.from(document.querySelectorAll('video')).filter(v => 
        v.style.display === 'none' && v.parentElement === document.body
      )
      
      if (hiddenVideos.length === 0) {
        setStatusMessage("Waiting for video elements...")
        return
      }

      // Check if any video has valid dimensions
      const hasValidVideo = hiddenVideos.some(v => v.videoWidth > 0 && v.videoHeight > 0)
      if (!hasValidVideo) {
        setStatusMessage("Waiting for video stream...")
        return
      }

      // Check pose detection status
      const status = (window as any).__poseDetectionStatus
      if (status === 'no_video_elements') {
        setStatusMessage("No video elements available")
        return
      }
      if (status === 'processing') {
        setStatusMessage("Detecting pose...")
        return
      }

      setStatusMessage("Ready - waiting for pose detection...")
    }

    checkStatus()
    const interval = setInterval(checkStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  // Show loading/error state if no data yet
  if (!angles && !metrics) {
    return (
      <Card className="absolute bottom-4 right-4 z-20 bg-black/80 backdrop-blur-sm border-white/20 p-3 max-w-sm">
        <div className="flex items-center gap-2">
          {showError ? (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          ) : (
            <Activity className="h-4 w-4 text-primary animate-pulse" />
          )}
          <span className="text-xs text-white/60">{statusMessage}</span>
        </div>
        <div className="text-[10px] text-white/40 mt-1">
          Check browser console for details
        </div>
      </Card>
    )
  }

  const formatAngle = (angle: number | null) => {
    if (angle === null) return "N/A"
    return `${Math.round(angle)}°`
  }

  const formatScore = (score: number) => {
    return `${Math.round(score)}`
  }

  return (
    <Card className="absolute bottom-4 right-4 z-20 bg-black/80 backdrop-blur-sm border-white/20 p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-white">Real-Time Metrics</h3>
        <span className="text-xs text-white/60 ml-auto">{participantName}</span>
      </div>

      {/* Scores */}
      {metrics && (
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Balance</div>
              <div className="text-white font-bold text-sm">{formatScore(metrics.balanceScore)}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Symmetry</div>
              <div className="text-white font-bold text-sm">{formatScore(metrics.symmetryScore)}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Postural</div>
              <div className="text-white font-bold text-sm">{formatScore(metrics.posturalEfficiency)}</div>
            </div>
          </div>
          {metrics.centerOfMass && (
            <div className="text-xs text-white/60">
              Center of Mass: ({metrics.centerOfMass.x.toFixed(2)}, {metrics.centerOfMass.y.toFixed(2)})
            </div>
          )}
        </div>
      )}

      {/* Angles */}
      {angles && (
        <div className="space-y-2 text-xs">
          <div className="text-white/80 font-medium mb-2">Joint Angles</div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Left Knee</div>
              <div className="text-white font-semibold">{formatAngle(angles.leftKnee)}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Right Knee</div>
              <div className="text-white font-semibold">{formatAngle(angles.rightKnee)}</div>
            </div>
            
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Left Hip</div>
              <div className="text-white font-semibold">{formatAngle(angles.leftHip)}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Right Hip</div>
              <div className="text-white font-semibold">{formatAngle(angles.rightHip)}</div>
            </div>
            
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Left Shoulder</div>
              <div className="text-white font-semibold">{formatAngle(angles.leftShoulder)}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Right Shoulder</div>
              <div className="text-white font-semibold">{formatAngle(angles.rightShoulder)}</div>
            </div>
            
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Left Elbow</div>
              <div className="text-white font-semibold">{formatAngle(angles.leftElbow)}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Right Elbow</div>
              <div className="text-white font-semibold">{formatAngle(angles.rightElbow)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Spine Lean</div>
              <div className="text-white font-semibold">{formatAngle(angles.spineLean)}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/60 mb-1">Neck Flexion</div>
              <div className="text-white font-semibold">{formatAngle(angles.neckFlexion)}</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

