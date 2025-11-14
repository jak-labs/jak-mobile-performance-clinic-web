"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TrendingUp, TrendingDown, Minus, CheckCircle2, Calendar, Target } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ProgressReportModalProps {
  isOpen: boolean
  onClose: () => void
}

interface MetricComparison {
  name: string
  baseline: number
  latest: number
  unit: string
  trend: "up" | "down" | "stable"
  isPositive: boolean
}

export default function ProgressReportModal({ isOpen, onClose }: ProgressReportModalProps) {
  const metrics: MetricComparison[] = [
    {
      name: "Balance Score",
      baseline: 65,
      latest: 78,
      unit: "index",
      trend: "up",
      isPositive: true,
    },
    {
      name: "Symmetry Score",
      baseline: 72,
      latest: 85,
      unit: "index",
      trend: "up",
      isPositive: true,
    },
    {
      name: "Power Consistency",
      baseline: 68,
      latest: 83,
      unit: "%",
      trend: "up",
      isPositive: true,
    },
    {
      name: "Balance Loss",
      baseline: 28,
      latest: 15,
      unit: "%",
      trend: "down",
      isPositive: true,
    },
    {
      name: "Symmetry Drift",
      baseline: 32,
      latest: 18,
      unit: "%",
      trend: "down",
      isPositive: true,
    },
    {
      name: "Recovery Efficiency",
      baseline: 58,
      latest: 75,
      unit: "index",
      trend: "up",
      isPositive: true,
    },
  ]

  const adherenceData = {
    sessionsCompleted: 12,
    sessionsScheduled: 15,
    adherenceRate: 80,
    currentStreak: 5,
  }

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />
      case "stable":
        return <Minus className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getChangePercentage = (baseline: number, latest: number) => {
    const change = ((latest - baseline) / baseline) * 100
    return Math.abs(Math.round(change))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[1200px] w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Progress Report</DialogTitle>
          <p className="text-sm text-muted-foreground">Baseline vs Latest Performance Analysis</p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Adherence Stats */}
          <Card className="p-6 bg-muted/50">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Session Adherence
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-foreground">
                  {adherenceData.sessionsCompleted}/{adherenceData.sessionsScheduled}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Adherence Rate</p>
                <p className="text-2xl font-bold text-green-600">{adherenceData.adherenceRate}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Current Streak</p>
                <p className="text-2xl font-bold text-primary">{adherenceData.currentStreak} days</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-lg font-semibold text-green-600">On Track</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Metrics Comparison */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Performance Metrics: Baseline vs Latest
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.map((metric, index) => (
                <Card key={index} className="p-4 bg-background">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground">{metric.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {metric.trend === "up" && metric.isPositive && "Improved"}
                        {metric.trend === "down" && metric.isPositive && "Improved"}
                        {metric.trend === "stable" && "Stable"}
                        {metric.trend === "up" && !metric.isPositive && "Declined"}
                        {metric.trend === "down" && !metric.isPositive && "Declined"}
                      </p>
                    </div>
                    {getTrendIcon(metric.trend)}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Baseline</p>
                      <p className="text-xl font-bold text-muted-foreground">
                        {metric.baseline}
                        <span className="text-sm ml-1">{metric.unit}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Latest</p>
                      <p className="text-xl font-bold text-primary">
                        {metric.latest}
                        <span className="text-sm ml-1">{metric.unit}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Change: </span>
                      <span
                        className={`font-semibold ${
                          metric.isPositive
                            ? metric.trend === "up"
                              ? "text-green-600"
                              : metric.trend === "down"
                                ? "text-green-600"
                                : "text-muted-foreground"
                            : metric.trend === "up"
                              ? "text-red-600"
                              : metric.trend === "down"
                                ? "text-red-600"
                                : "text-muted-foreground"
                        }`}
                      >
                        {metric.trend === "up" ? "+" : metric.trend === "down" ? "-" : ""}
                        {getChangePercentage(metric.baseline, metric.latest)}%
                      </span>
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Summary */}
          <Card className="p-6 bg-primary/10 border-primary/20">
            <h3 className="text-lg font-semibold mb-3 text-primary">Overall Assessment</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              <strong>Excellent progress</strong> demonstrated across all key metrics. Balance and symmetry scores have
              improved by an average of <strong>18%</strong> since baseline. Fatigue metrics show{" "}
              <strong>significant reduction</strong> in balance loss and symmetry drift, indicating improved endurance
              and stability. With an <strong>80% adherence rate</strong> and consistent session completion, the athlete
              is on track to meet their performance goals. Recommend continuing current protocol with potential
              progression to Level 2 exercises in the next phase.
            </p>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
