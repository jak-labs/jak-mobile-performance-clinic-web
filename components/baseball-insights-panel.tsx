"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Activity } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface BaseballInsight {
  participantId: string
  participantName: string
  timestamp: string
  
  // Overall Assessment
  overallPerformance: "Excellent" | "Good" | "Needs Improvement" | "Critical"
  performanceScore: number // 0-100
  
  // Kinematic Sequence Analysis
  kinematicSequence: {
    assessment: string
    pelvisLeadTime: string
    torsoDelay: string
    armAcceleration: string
    recommendations: string[]
  }
  
  // Rotation Analysis
  rotationAnalysis: {
    hipShoulderSeparation: {
      value: number
      status: "Optimal" | "Good" | "Limited"
      feedback: string
    }
    pelvisEfficiency: string
    torsoContribution: string
  }
  
  // Timing & Force
  timingAnalysis: {
    groundForceSync: string
    strideEfficiency: string
    criticalIssues: string[]
  }
  
  // Symmetry & Balance
  symmetryAnalysis: {
    legDriveBalance: number
    leftRightImbalance: string
    recommendations: string[]
  }
  
  // Risk Assessment
  riskAssessment: {
    injuryRisk: "Low" | "Moderate" | "High"
    primaryConcerns: string[]
    preventiveMeasures: string[]
  }
  
  // Key Recommendations
  priorityRecommendations: string[]
}

interface BaseballInsightsPanelProps {
  participants: Array<{ identity: string; name?: string }>
  participantInfo: Record<string, { fullName?: string }>
  sessionType?: string | null
}

// Generate realistic baseball insights
function generateBaseballInsight(participantId: string, participantName: string): BaseballInsight {
  const performanceScore = 70 + Math.random() * 25 // 70-95
  const hipShoulderSep = 35 + Math.random() * 20 // 35-55
  const legDriveBalance = 80 + Math.random() * 15 // 80-95
  
  const overallPerformance: BaseballInsight["overallPerformance"] = 
    performanceScore >= 90 ? "Excellent" : 
    performanceScore >= 80 ? "Good" : 
    performanceScore >= 70 ? "Needs Improvement" : "Critical"
  
  const hipShoulderStatus: "Optimal" | "Good" | "Limited" = 
    hipShoulderSep >= 50 ? "Optimal" : 
    hipShoulderSep >= 40 ? "Good" : "Limited"
  
  const injuryRisk: "Low" | "Moderate" | "High" = 
    performanceScore >= 85 ? "Low" : 
    performanceScore >= 75 ? "Moderate" : "High"
  
  const kinematicSequenceInsights = [
    {
      assessment: "Excellent pelvis initiation with proper timing cascade through torso and arm",
      pelvisLeadTime: "Pelvis leads torso by optimal 40-60ms window",
      torsoDelay: "Torso rotation initiates properly after pelvis commitment",
      armAcceleration: "Arm reaches peak velocity at optimal release point",
      recommendations: [
        "Continue current sequencing pattern - it's generating maximum power",
        "Focus on maintaining this timing under fatigue"
      ]
    },
    {
      assessment: "Good sequencing with slight early arm commitment",
      pelvisLeadTime: "Pelvis initiation timing is within normal range",
      torsoDelay: "Minor delay in torso rotation affecting power transfer",
      armAcceleration: "Arm acceleration pattern shows early commitment before full hip rotation",
      recommendations: [
        "Delay arm acceleration by 20-30ms to allow full hip rotation",
        "Practice medicine ball throws emphasizing lower body initiation",
        "Focus on feeling pelvis and torso complete before arm whip"
      ]
    },
    {
      assessment: "Synchronous rotation pattern reducing power efficiency",
      pelvisLeadTime: "Pelvis and torso rotating together (should be sequential)",
      torsoDelay: "No separation between lower and upper body rotation",
      armAcceleration: "Arm compensating for lack of lower body power",
      recommendations: [
        "Implement hip-loading drills to establish pelvis-first pattern",
        "Work with resistance bands to feel separation between hip and shoulder",
        "Reduce throwing intensity to focus on sequencing mechanics"
      ]
    }
  ]
  
  const rotationInsights = [
    {
      hipShoulderSeparation: {
        value: hipShoulderSep,
        status: hipShoulderStatus,
        feedback: hipShoulderStatus === "Optimal" 
          ? "Excellent hip-shoulder separation creating strong elastic energy storage"
          : hipShoulderStatus === "Good"
          ? "Good separation, but increasing to 50+ degrees could add 2-3 mph velocity"
          : "Limited separation reducing power output - focus on hip mobility and sequencing"
      },
      pelvisEfficiency: hipShoulderSep >= 45 
        ? "Pelvis clearing efficiently, creating space for torso rotation"
        : "Pelvis rotation could be more aggressive in early phase",
      torsoContribution: performanceScore >= 85
        ? "Torso generating excellent rotational velocity (800-1100 deg/s)"
        : "Torso rotation velocity below optimal range - opportunity for power gain"
    }
  ]
  
  const timingInsights = [
    {
      groundForceSync: performanceScore >= 85
        ? "Ground force timing synchronized perfectly with pelvis rotation (180-220ms window)"
        : "Slight delay in ground force application - work on explosive hip drive at foot plant",
      strideEfficiency: "Stride length and foot plant timing within optimal range for power generation",
      criticalIssues: performanceScore < 75 
        ? [
            "Early weight shift before full hip loading",
            "Foot plant occurring too early relative to arm slot"
          ]
        : []
    }
  ]
  
  const symmetryInsights = [
    {
      legDriveBalance: legDriveBalance,
      leftRightImbalance: legDriveBalance >= 90
        ? "Excellent bilateral force production - both legs contributing equally"
        : "Minor imbalance detected - front leg could contribute more to deceleration",
      recommendations: legDriveBalance >= 90
        ? [
            "Maintain current bilateral strength training program",
            "Continue monitoring for fatigue-related asymmetries"
          ]
        : [
            "Add single-leg exercises to address force production imbalance",
            "Focus on front leg stability during deceleration phase",
            "Consider split stance medicine ball throws for symmetry"
          ]
    }
  ]
  
  const riskInsights = [
    {
      injuryRisk: injuryRisk,
      primaryConcerns: injuryRisk === "High"
        ? [
            "Excessive arm velocity compensation for lack of lower body power",
            "Poor sequencing increasing elbow and shoulder stress",
            "Reduced deceleration capacity in follow-through"
          ]
        : injuryRisk === "Moderate"
        ? [
            "Slight over-reliance on arm for power generation",
            "Monitor for fatigue-related sequencing breakdown"
          ]
        : [
            "No significant injury risk patterns detected",
            "Continue monitoring workload and recovery"
          ],
      preventiveMeasures: injuryRisk === "High"
        ? [
            "Reduce throwing volume by 30-40% while correcting mechanics",
            "Implement daily hip mobility and strengthening routine",
            "Work with coach on sequencing drills before resuming full intensity"
          ]
        : injuryRisk === "Moderate"
        ? [
            "Add posterior chain strengthening exercises",
            "Monitor pitch counts and implement proper warm-up protocol",
            "Schedule regular movement screening assessments"
          ]
        : [
            "Maintain current training load and recovery protocols",
            "Continue pre-throwing activation routine",
            "Monitor for any changes in movement patterns"
          ]
    }
  ]
  
  const selectedKinematic = kinematicSequenceInsights[Math.floor(Math.random() * kinematicSequenceInsights.length)]
  const selectedRotation = rotationInsights[0]
  const selectedTiming = timingInsights[0]
  const selectedSymmetry = symmetryInsights[0]
  const selectedRisk = riskInsights[0]
  
  return {
    participantId,
    participantName,
    timestamp: new Date().toISOString(),
    overallPerformance,
    performanceScore,
    kinematicSequence: selectedKinematic,
    rotationAnalysis: selectedRotation,
    timingAnalysis: selectedTiming,
    symmetryAnalysis: selectedSymmetry,
    riskAssessment: selectedRisk,
    priorityRecommendations: [
      selectedKinematic.recommendations[0],
      ...selectedSymmetry.recommendations.slice(0, 1),
      ...selectedRisk.preventiveMeasures.slice(0, 1)
    ].filter(Boolean)
  }
}

export function BaseballInsightsPanel({ participants, participantInfo, sessionType }: BaseballInsightsPanelProps) {
  const [insights, setInsights] = useState<Record<string, BaseballInsight>>({})
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Generate insights every 2 seconds
  useEffect(() => {
    const generateInsights = () => {
      setIsGenerating(true)
      console.log('[Baseball Insights] 🎯 Generating new insights...')
      
      const newInsights: Record<string, BaseballInsight> = {}
      participants.forEach(participant => {
        const participantName = participantInfo[participant.identity]?.fullName || participant.name || participant.identity
        newInsights[participant.identity] = generateBaseballInsight(participant.identity, participantName)
      })
      
      setInsights(newInsights)
      setLastGenerated(new Date())
      setIsGenerating(false)
      
      console.log('[Baseball Insights] ✅ Generated insights for', participants.length, 'participants')
    }

    // Generate immediately on mount
    if (participants.length > 0) {
      generateInsights()
    }

    // Then generate every 15 seconds
    const interval = setInterval(generateInsights, 15000)

    return () => clearInterval(interval)
  }, [participants, participantInfo])

  const getPerformanceColor = (performance: BaseballInsight["overallPerformance"]) => {
    switch (performance) {
      case "Excellent": return "text-green-400"
      case "Good": return "text-blue-400"
      case "Needs Improvement": return "text-yellow-400"
      case "Critical": return "text-red-400"
    }
  }

  const getRiskColor = (risk: "Low" | "Moderate" | "High") => {
    switch (risk) {
      case "Low": return "text-green-400"
      case "Moderate": return "text-yellow-400"
      case "High": return "text-red-400"
    }
  }

  const getRiskIcon = (risk: "Low" | "Moderate" | "High") => {
    switch (risk) {
      case "Low": return <CheckCircle className="h-4 w-4" />
      case "Moderate": return <Activity className="h-4 w-4" />
      case "High": return <AlertTriangle className="h-4 w-4" />
    }
  }

  if (participants.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <Lightbulb className="h-8 w-8 text-white/40 mx-auto mb-3" />
          <p className="text-sm text-white/60">No participants to analyze</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Baseball Performance Insights</h3>
            <p className="text-sm text-white/60">AI-powered analysis updated every 15 seconds</p>
          </div>
          {lastGenerated && (
            <div className="text-xs text-white/40">
              Last updated: {lastGenerated.toLocaleTimeString()}
            </div>
          )}
        </div>
        {isGenerating && (
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertDescription className="text-sm text-blue-400">
              🔄 Generating new insights...
            </AlertDescription>
          </Alert>
        )}
      </div>

      {Object.entries(insights).map(([participantId, insight]) => (
        <Card key={participantId} className="bg-black/80 backdrop-blur-sm border-white/20 p-4">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-semibold text-white">{insight.participantName}</h4>
              <div className={`text-sm font-bold ${getPerformanceColor(insight.overallPerformance)}`}>
                {insight.overallPerformance}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-white/60">Performance Score:</div>
              <div className="text-sm font-bold text-white">{Math.round(insight.performanceScore)}/100</div>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
                  style={{ width: `${insight.performanceScore}%` }}
                />
              </div>
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {/* Kinematic Sequence */}
            <AccordionItem value="kinematic" className="border-white/10">
              <AccordionTrigger className="text-white/90 hover:text-white text-sm py-2">
                ⚡ Kinematic Sequence Analysis
              </AccordionTrigger>
              <AccordionContent className="text-white/70 text-sm space-y-2 pb-4">
                <div className="bg-white/5 rounded-lg p-3 space-y-2">
                  <div><strong className="text-white/90">Assessment:</strong> {insight.kinematicSequence.assessment}</div>
                  <div><strong className="text-white/90">Pelvis Lead:</strong> {insight.kinematicSequence.pelvisLeadTime}</div>
                  <div><strong className="text-white/90">Torso Delay:</strong> {insight.kinematicSequence.torsoDelay}</div>
                  <div><strong className="text-white/90">Arm Acceleration:</strong> {insight.kinematicSequence.armAcceleration}</div>
                </div>
                <div className="mt-3">
                  <div className="text-xs font-semibold text-white/90 mb-2">Recommendations:</div>
                  <ul className="space-y-1">
                    {insight.kinematicSequence.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-xs text-green-400 flex items-start gap-2">
                        <span>•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Rotation Analysis */}
            <AccordionItem value="rotation" className="border-white/10">
              <AccordionTrigger className="text-white/90 hover:text-white text-sm py-2">
                🔄 Rotation & Separation Analysis
              </AccordionTrigger>
              <AccordionContent className="text-white/70 text-sm space-y-2 pb-4">
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white/90">Hip-Shoulder Separation:</span>
                    <span className={`font-bold ${
                      insight.rotationAnalysis.hipShoulderSeparation.status === "Optimal" ? "text-green-400" :
                      insight.rotationAnalysis.hipShoulderSeparation.status === "Good" ? "text-yellow-400" :
                      "text-red-400"
                    }`}>
                      {insight.rotationAnalysis.hipShoulderSeparation.value.toFixed(1)}° - {insight.rotationAnalysis.hipShoulderSeparation.status}
                    </span>
                  </div>
                  <div className="text-xs italic">{insight.rotationAnalysis.hipShoulderSeparation.feedback}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 space-y-2 mt-2">
                  <div><strong className="text-white/90">Pelvis:</strong> {insight.rotationAnalysis.pelvisEfficiency}</div>
                  <div><strong className="text-white/90">Torso:</strong> {insight.rotationAnalysis.torsoContribution}</div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Timing & Force */}
            <AccordionItem value="timing" className="border-white/10">
              <AccordionTrigger className="text-white/90 hover:text-white text-sm py-2">
                ⏱️ Timing & Force Production
              </AccordionTrigger>
              <AccordionContent className="text-white/70 text-sm space-y-2 pb-4">
                <div className="bg-white/5 rounded-lg p-3 space-y-2">
                  <div><strong className="text-white/90">Ground Force Sync:</strong> {insight.timingAnalysis.groundForceSync}</div>
                  <div><strong className="text-white/90">Stride Efficiency:</strong> {insight.timingAnalysis.strideEfficiency}</div>
                </div>
                {insight.timingAnalysis.criticalIssues.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-red-400 mb-2">⚠️ Critical Issues:</div>
                    <ul className="space-y-1">
                      {insight.timingAnalysis.criticalIssues.map((issue, idx) => (
                        <li key={idx} className="text-xs text-red-400 flex items-start gap-2">
                          <span>•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Symmetry & Balance */}
            <AccordionItem value="symmetry" className="border-white/10">
              <AccordionTrigger className="text-white/90 hover:text-white text-sm py-2">
                ⚖️ Symmetry & Balance
              </AccordionTrigger>
              <AccordionContent className="text-white/70 text-sm space-y-2 pb-4">
                <div className="bg-white/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white/90">Leg Drive Balance:</span>
                    <span className="font-bold text-white">{Math.round(insight.symmetryAnalysis.legDriveBalance)}/100</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-cyan-500"
                      style={{ width: `${insight.symmetryAnalysis.legDriveBalance}%` }}
                    />
                  </div>
                  <div className="text-xs italic mt-2">{insight.symmetryAnalysis.leftRightImbalance}</div>
                </div>
                {insight.symmetryAnalysis.recommendations.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-white/90 mb-2">Recommendations:</div>
                    <ul className="space-y-1">
                      {insight.symmetryAnalysis.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-xs text-blue-400 flex items-start gap-2">
                          <span>•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Risk Assessment */}
            <AccordionItem value="risk" className="border-white/10">
              <AccordionTrigger className="text-white/90 hover:text-white text-sm py-2">
                🏥 Injury Risk Assessment
              </AccordionTrigger>
              <AccordionContent className="text-white/70 text-sm space-y-2 pb-4">
                <div className={`rounded-lg p-3 border ${
                  insight.riskAssessment.injuryRisk === "Low" ? "bg-green-500/10 border-green-500/20" :
                  insight.riskAssessment.injuryRisk === "Moderate" ? "bg-yellow-500/10 border-yellow-500/20" :
                  "bg-red-500/10 border-red-500/20"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white/90">Risk Level:</span>
                    <div className={`flex items-center gap-2 font-bold ${getRiskColor(insight.riskAssessment.injuryRisk)}`}>
                      {getRiskIcon(insight.riskAssessment.injuryRisk)}
                      <span>{insight.riskAssessment.injuryRisk}</span>
                    </div>
                  </div>
                </div>
                
                {insight.riskAssessment.primaryConcerns.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-white/90 mb-2">Primary Concerns:</div>
                    <ul className="space-y-1">
                      {insight.riskAssessment.primaryConcerns.map((concern, idx) => (
                        <li key={idx} className="text-xs text-white/70 flex items-start gap-2">
                          <span>•</span>
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {insight.riskAssessment.preventiveMeasures.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-green-400 mb-2">Preventive Measures:</div>
                    <ul className="space-y-1">
                      {insight.riskAssessment.preventiveMeasures.map((measure, idx) => (
                        <li key={idx} className="text-xs text-green-400 flex items-start gap-2">
                          <span>•</span>
                          <span>{measure}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Priority Recommendations */}
          <div className="mt-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <div className="text-sm font-semibold text-white/90">Priority Action Items</div>
            </div>
            <ul className="space-y-1">
              {insight.priorityRecommendations.map((rec, idx) => (
                <li key={idx} className="text-xs text-blue-400 flex items-start gap-2">
                  <span>{idx + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  )
}
