"use client"

import { Card } from "@/components/ui/card"
import { Activity, AlertCircle } from "lucide-react"
import type { BiomechanicalAngles, BiomechanicalMetrics } from "@/lib/pose-detection"
import { useRealtimeMetrics } from "@/lib/realtime-metrics-context"
import { useEffect, useRef, useState } from "react"

interface LiveMetricsTabProps {
  participants: Array<{ identity: string; name: string }>
  participantInfo: Record<string, { fullName?: string }>
  sessionType?: string | null
  subjectId?: string | null
}

export function LiveMetricsTab({ participants, participantInfo, sessionType, subjectId }: LiveMetricsTabProps) {
  const { realtimeData } = useRealtimeMetrics()
  const [displayData, setDisplayData] = useState(realtimeData)
  const latestDataRef = useRef(realtimeData)

  useEffect(() => {
    latestDataRef.current = realtimeData
  }, [realtimeData])

  // Refresh UI every 5 seconds to show latest metrics
  useEffect(() => {
    setDisplayData(latestDataRef.current)
    const interval = setInterval(() => {
      setDisplayData(latestDataRef.current)
    }, 5000)
    return () => clearInterval(interval)
  }, [])
  
  // Debug: Log realtimeData changes
  useEffect(() => {
    const keys = Object.keys(displayData)
    console.log(`[Live Metrics Tab] 📊 Realtime data check:`, {
      keys,
      keysCount: keys.length,
      participants: participants.map(p => p.identity),
      sessionType,
      subjectId,
      isMocap: sessionType === 'mocap',
      data: keys.map(key => ({
        participantId: key,
        hasAngles: !!displayData[key]?.angles,
        hasMetrics: !!displayData[key]?.metrics,
        balance: displayData[key]?.metrics?.balanceScore,
        symmetry: displayData[key]?.metrics?.symmetryScore
      }))
    })
    
    // For mocap sessions, specifically check if subjectId has data
    if (sessionType === 'mocap' && subjectId) {
      const hasSubjectData = displayData[subjectId]?.angles || displayData[subjectId]?.metrics
      console.log(`[Live Metrics Tab] 🎯 Mocap session check - subjectId "${subjectId}" has data:`, hasSubjectData)
      if (hasSubjectData) {
        console.log(`[Live Metrics Tab] ✅ Found metrics for subjectId:`, displayData[subjectId])
      } else {
        console.log(`[Live Metrics Tab] ⚠️ No metrics found for subjectId "${subjectId}" - checking all keys:`, keys)
      }
    }
  }, [displayData, participants, sessionType, subjectId])

  const formatAngle = (angle: number | null) => {
    if (angle === null) return "N/A"
    return `${Math.round(angle)}°`
  }

  const formatScore = (score: number) => {
    return `${Math.round(score)}`
  }

  // For mocap sessions: check for metrics using subjectId instead of participant identity
  // Coach is in session pointing camera at athlete, so metrics are stored under subjectId
  const isMocapSession = sessionType === 'mocap'
  
  // Debug: Log what we're looking for
  console.log(`[Live Metrics Tab] 🔍 Looking for metrics:`, {
    isMocapSession,
    subjectId,
    realtimeDataKeys: Object.keys(displayData),
    participants: participants.map(p => p.identity),
    checkingSubjectId: isMocapSession && subjectId ? displayData[subjectId] : null
  })
  
  // Filter participants that have metrics
  // For mocap: check if subjectId has metrics, otherwise check participant identities
  const participantsWithMetrics = isMocapSession && subjectId
    ? (displayData[subjectId]?.angles || displayData[subjectId]?.metrics)
      ? (() => {
          console.log(`[Live Metrics Tab] ✅ Found metrics for subjectId "${subjectId}"`)
          return [{ identity: subjectId, name: participantInfo[subjectId]?.fullName || 'Athlete' }]
        })()
      : (() => {
          console.log(`[Live Metrics Tab] ⚠️ No metrics found for subjectId "${subjectId}" in realtimeData`)
          console.log(`[Live Metrics Tab] Available keys:`, Object.keys(displayData))
          return []
        })()
    : participants.filter(p => {
        const hasMetrics = displayData[p.identity]?.angles || displayData[p.identity]?.metrics
        if (!hasMetrics) {
          console.log(`[Live Metrics Tab] ⚠️ No metrics for participant "${p.identity}"`)
        }
        return hasMetrics
      })
  
  console.log(`[Live Metrics Tab] 📊 Participants with metrics: ${participantsWithMetrics.length}`, participantsWithMetrics.map(p => p.identity))

  // Show empty state if no metrics available (no waiting box)
  if (participantsWithMetrics.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <Activity className="h-8 w-8 text-white/40 mx-auto mb-3" />
          <p className="text-sm text-white/60">No metrics available yet</p>
          {isMocapSession && (
            <p className="text-xs text-white/40 mt-2">Point camera at athlete to start analysis</p>
          )}
        </div>
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
        const data = displayData[participant.identity]
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

