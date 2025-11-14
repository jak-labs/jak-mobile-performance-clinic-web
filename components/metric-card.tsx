"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

interface MetricCardProps {
  name: string
  value: number
  unit: string
  inverted?: boolean
}

export default function MetricCard({ name, value, unit, inverted = false }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (Math.abs(value - displayValue) > 0.1) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 500)

      // Smooth animation
      const steps = 10
      const increment = (value - displayValue) / steps
      let currentStep = 0

      const interval = setInterval(() => {
        currentStep++
        setDisplayValue((prev) => {
          if (currentStep >= steps) {
            clearInterval(interval)
            return value
          }
          return prev + increment
        })
      }, 30)

      return () => {
        clearTimeout(timer)
        clearInterval(interval)
      }
    }
  }, [value, displayValue])

  const getStatusColor = (val: number, inv: boolean) => {
    const effectiveValue = inv ? 100 - val : val
    if (effectiveValue >= 75) return "success"
    if (effectiveValue >= 50) return "warning"
    return "error"
  }

  const status = getStatusColor(displayValue, inverted)
  const statusColors = {
    success: "bg-success/10 border-success/30",
    warning: "bg-warning/10 border-warning/30",
    error: "bg-error/10 border-error/30",
  }

  const indicatorColors = {
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
  }

  return (
    <Card
      className={`p-4 transition-all duration-300 ${
        isAnimating ? "scale-[1.02] shadow-lg" : ""
      } ${statusColors[status]}`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground text-pretty leading-tight">{name}</h3>
        <div className={`w-2 h-2 rounded-full ${indicatorColors[status]} flex-shrink-0 mt-1`} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold font-mono text-foreground tabular-nums">{displayValue.toFixed(0)}</span>
        <span className="text-sm text-muted-foreground font-medium">{unit}</span>
      </div>
    </Card>
  )
}
