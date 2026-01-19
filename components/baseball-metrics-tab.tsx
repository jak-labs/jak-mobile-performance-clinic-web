"use client"

import { Card } from "@/components/ui/card"
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useEffect, useState } from "react"

interface BaseballMetricsTabProps {
  participants: Array<{ identity: string; name: string }>
  participantInfo: Record<string, { fullName?: string }>
  sessionType?: string | null
  subjectId?: string | null
}

interface BaseballMetrics {
  // Kinematic Sequence - time-stamped angular velocity
  kinematicSequence: {
    pelvisVelocity: number // deg/s
    torsoVelocity: number // deg/s
    armVelocity: number // deg/s
    sequenceScore: number // 0-100
  }
  
  // Rotation metrics
  pelvisRotation: number // degrees
  torsoRotation: number // degrees
  shoulderAngles: {
    throwing: number // degrees
    glove: number // degrees
  }
  
  // Separation and timing
  hipShoulderSeparation: number // degrees
  groundForceTiming: number // milliseconds
  strideToFootPlant: number // milliseconds
  
  // Symmetry and balance
  legDriveSymmetry: number // 0-100 score
  hipRotation: {
    internal: number // degrees
    external: number // degrees
  }
  
  // Overall index
  kinematicImbalanceIndex: number // 0-100 (higher is better)
}

// Generate realistic dummy baseball metrics
function generateDummyMetrics(): BaseballMetrics {
  return {
    kinematicSequence: {
      pelvisVelocity: 600 + Math.random() * 200, // 600-800 deg/s
      torsoVelocity: 800 + Math.random() * 300, // 800-1100 deg/s
      armVelocity: 5000 + Math.random() * 2000, // 5000-7000 deg/s
      sequenceScore: 75 + Math.random() * 20, // 75-95
    },
    pelvisRotation: 45 + Math.random() * 15, // 45-60 degrees
    torsoRotation: 80 + Math.random() * 25, // 80-105 degrees
    shoulderAngles: {
      throwing: 160 + Math.random() * 20, // 160-180 degrees
      glove: 90 + Math.random() * 30, // 90-120 degrees
    },
    hipShoulderSeparation: 35 + Math.random() * 20, // 35-55 degrees
    groundForceTiming: 180 + Math.random() * 60, // 180-240 ms
    strideToFootPlant: 140 + Math.random() * 40, // 140-180 ms
    legDriveSymmetry: 80 + Math.random() * 15, // 80-95
    hipRotation: {
      internal: 35 + Math.random() * 15, // 35-50 degrees
      external: 40 + Math.random() * 15, // 40-55 degrees
    },
    kinematicImbalanceIndex: 75 + Math.random() * 20, // 75-95
  }
}

export function BaseballMetricsTab({ participants, participantInfo, sessionType, subjectId }: BaseballMetricsTabProps) {
  const [metricsData, setMetricsData] = useState<Record<string, BaseballMetrics>>({})
  
  // Generate dummy metrics for all participants and update every second
  useEffect(() => {
    // Initialize metrics for all participants
    const isMocapSession = sessionType === 'mocap'
    const participantIds = isMocapSession && subjectId 
      ? [subjectId]
      : participants.map(p => p.identity)
    
    // Initial metrics
    const initialMetrics: Record<string, BaseballMetrics> = {}
    participantIds.forEach(id => {
      initialMetrics[id] = generateDummyMetrics()
    })
    setMetricsData(initialMetrics)
    
    // Update metrics every second
    const interval = setInterval(() => {
      const updatedMetrics: Record<string, BaseballMetrics> = {}
      participantIds.forEach(id => {
        updatedMetrics[id] = generateDummyMetrics()
      })
      setMetricsData(updatedMetrics)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [participants, sessionType, subjectId])

  const formatNumber = (value: number, decimals: number = 0) => {
    return value.toFixed(decimals)
  }

  const formatScore = (score: number) => {
    return Math.round(score)
  }

  const getScoreColor = (score: number, isReverse: boolean = false) => {
    const threshold = isReverse ? 40 : 70
    if (isReverse) {
      return score < threshold ? "text-green-400" : score < 60 ? "text-yellow-400" : "text-red-400"
    }
    return score >= 85 ? "text-green-400" : score >= threshold ? "text-yellow-400" : "text-red-400"
  }

  const getTrendIcon = (value: number, threshold: number, isReverse: boolean = false) => {
    const isGood = isReverse ? value < threshold : value >= threshold
    if (value === threshold) return <Minus className="h-3 w-3 text-white/40" />
    return isGood ? <TrendingUp className="h-3 w-3 text-green-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />
  }

  // Determine which participants to show
  const isMocapSession = sessionType === 'mocap'
  const displayParticipants = isMocapSession && subjectId
    ? [{ identity: subjectId, name: participantInfo[subjectId]?.fullName || 'Athlete' }]
    : participants

  // Show empty state if no participants
  if (displayParticipants.length === 0) {
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
        <h3 className="text-lg font-semibold text-white mb-1">Baseball Performance Metrics</h3>
        <p className="text-sm text-white/60">Real-time biomechanical analysis for pitching and hitting</p>
        <p className="text-xs text-yellow-400/80 mt-1">⚡ Live Demo - Updates every second</p>
      </div>

      {displayParticipants.map((participant) => {
        const metrics = metricsData[participant.identity]
        if (!metrics) return null
        
        const participantName = participantInfo[participant.identity]?.fullName || participant.name || participant.identity

        return (
          <Card key={participant.identity} className="bg-black/80 backdrop-blur-sm border-white/20 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-primary" />
              <h4 className="text-base font-semibold text-white">{participantName}</h4>
            </div>

            {/* Kinematic Sequence */}
            <div className="mb-4 space-y-3">
              <h5 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                Kinematic Sequence
                <span className="text-xs text-white/40">(Time-stamped angular velocity)</span>
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Pelvis Velocity</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.kinematicSequence.pelvisVelocity, 0)} °/s</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Torso Velocity</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.kinematicSequence.torsoVelocity, 0)} °/s</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Arm Velocity</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.kinematicSequence.armVelocity, 0)} °/s</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Sequence Score</div>
                  <div className={`font-bold text-lg ${getScoreColor(metrics.kinematicSequence.sequenceScore)}`}>
                    {formatScore(metrics.kinematicSequence.sequenceScore)}/100
                  </div>
                </div>
              </div>
              <div className="text-xs text-white/40 italic">
                Ensures proper sequencing for max power & efficiency
              </div>
            </div>

            {/* Rotation Metrics */}
            <div className="mb-4 space-y-3">
              <h5 className="text-sm font-medium text-white/80 mb-2">Rotation Metrics</h5>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Pelvis Rotation</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.pelvisRotation, 1)}°</div>
                  <div className="text-xs text-white/40 mt-1">Initiates rotation in swing/pitch</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Torso Rotation</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.torsoRotation, 1)}°</div>
                  <div className="text-xs text-white/40 mt-1">Transfers energy to upper body</div>
                </div>
              </div>
            </div>

            {/* Shoulder Angles */}
            <div className="mb-4 space-y-3">
              <h5 className="text-sm font-medium text-white/80 mb-2">Shoulder Angles</h5>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Throwing Shoulder</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.shoulderAngles.throwing, 1)}°</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Glove Shoulder</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.shoulderAngles.glove, 1)}°</div>
                </div>
              </div>
              <div className="text-xs text-white/40 italic">
                Controls arm path and reduces injury risk
              </div>
            </div>

            {/* Hip-Shoulder Separation */}
            <div className="mb-4">
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20">
                <div className="text-white/60 text-xs mb-1">Hip-Shoulder Separation</div>
                <div className="text-white font-bold text-2xl">{formatNumber(metrics.hipShoulderSeparation, 1)}°</div>
                <div className="text-xs text-white/40 mt-2 italic">
                  Maximizes stretch-shortening cycle efficiency
                </div>
              </div>
            </div>

            {/* Timing Metrics */}
            <div className="mb-4 space-y-3">
              <h5 className="text-sm font-medium text-white/80 mb-2">Timing Metrics</h5>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Ground Force Timing</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.groundForceTiming, 0)} ms</div>
                  <div className="text-xs text-white/40 mt-1">Key for power transfer</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Stride → Foot Plant</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.strideToFootPlant, 0)} ms</div>
                  <div className="text-xs text-white/40 mt-1">Swing/pitch initiation</div>
                </div>
              </div>
            </div>

            {/* Symmetry and Balance */}
            <div className="mb-4 space-y-3">
              <h5 className="text-sm font-medium text-white/80 mb-2">Symmetry & Balance</h5>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Leg Drive Symmetry</div>
                  <div className={`font-bold text-lg ${getScoreColor(metrics.legDriveSymmetry)}`}>
                    {formatScore(metrics.legDriveSymmetry)}/100
                  </div>
                  <div className="text-xs text-white/40 mt-1">Balance in force output</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Hip Internal Rot.</div>
                  <div className="text-white font-bold text-lg">{formatNumber(metrics.hipRotation.internal, 1)}°</div>
                </div>
              </div>
            </div>

            {/* Overall Performance Index */}
            <div className="mt-4">
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white/60 text-sm">Lower Body Kinematic Imbalance Index</div>
                  <div className={`font-bold text-2xl ${getScoreColor(metrics.kinematicImbalanceIndex)}`}>
                    {formatScore(metrics.kinematicImbalanceIndex)}/100
                  </div>
                </div>
                <div className="text-xs text-white/40 italic">
                  Flags deficiencies in movement patterns - Higher score = Better balance
                </div>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
                    style={{ width: `${metrics.kinematicImbalanceIndex}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
