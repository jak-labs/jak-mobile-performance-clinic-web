"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import type { BiomechanicalAngles, BiomechanicalMetrics } from "@/lib/pose-detection"

interface RealtimeMetricsData {
  angles: BiomechanicalAngles
  metrics: BiomechanicalMetrics
}

interface RealtimeMetricsContextType {
  realtimeData: Record<string, RealtimeMetricsData>
  setRealtimeData: (participantId: string, data: RealtimeMetricsData) => void
}

const RealtimeMetricsContext = createContext<RealtimeMetricsContextType | undefined>(undefined)

export function RealtimeMetricsProvider({ children }: { children: ReactNode }) {
  const [realtimeData, setRealtimeDataState] = useState<Record<string, RealtimeMetricsData>>({})

  const setRealtimeData = (participantId: string, data: RealtimeMetricsData) => {
    setRealtimeDataState(prev => ({
      ...prev,
      [participantId]: data
    }))
  }

  return (
    <RealtimeMetricsContext.Provider value={{ realtimeData, setRealtimeData }}>
      {children}
    </RealtimeMetricsContext.Provider>
  )
}

export function useRealtimeMetrics() {
  const context = useContext(RealtimeMetricsContext)
  if (!context) {
    // Return default values if context is not available (for components outside provider)
    return {
      realtimeData: {},
      setRealtimeData: () => {}
    }
  }
  return context
}

