"use client"

import { useState, useEffect } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Lightbulb, CheckCircle2, MoreVertical, Share2, Download, RefreshCw, FileText } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import MetricCard from "./metric-card"
import ProgressReportModal from "./progress-report-modal"

interface Exercise {
  id: string
  name: string
  completed: boolean
  active: boolean // Added active state to track current exercise
  insights?: string // Added AI insights for completed exercises
  metrics: {
    name: string
    value: number
    unit: string
    inverted?: boolean
  }[]
}

interface Phase {
  id: string
  name: string
  level: string
  exercises: Exercise[]
}

// Simulated real-time data
const generateMetricValue = (base: number, variance: number) => {
  return Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance))
}

export default function MetricsDashboard() {
  const [phases, setPhases] = useState<Phase[]>([
    {
      id: "warmup",
      name: "Warm-Up",
      level: "Level 1 (Foundation)",
      exercises: [
        {
          id: "ex1",
          name: "Dynamic Hip Flexor Stretch",
          completed: true,
          active: false,
          insights:
            "<strong>Excellent hip mobility</strong> demonstrated. Balance score of <strong>78</strong> shows good core stability. Consider focusing on <strong>deeper range of motion</strong> to improve symmetry score from 82 to 85+.",
          metrics: [
            { name: "Balance Score", value: 78, unit: "index" },
            { name: "Symmetry Score", value: 82, unit: "index" },
          ],
        },
        {
          id: "ex2",
          name: "World's Greatest Stretch",
          completed: true,
          active: false,
          insights:
            "<strong>Good thoracic rotation</strong> with 75 balance score. Symmetry at <strong>80</strong> indicates <strong>slight right-side dominance</strong>. Recommend additional focus on left-side mobility in future sessions.",
          metrics: [
            { name: "Balance Score", value: 75, unit: "index" },
            { name: "Symmetry Score", value: 80, unit: "index" },
          ],
        },
      ],
    },
    {
      id: "performance",
      name: "Performance",
      level: "Level 1 (Foundation)",
      exercises: [
        {
          id: "ex3",
          name: "Single-Leg Romanian Deadlift",
          completed: false,
          active: true,
          metrics: [
            { name: "Balance", value: 85, unit: "index" },
            { name: "Symmetry", value: 88, unit: "index" },
            { name: "Power Consistency", value: 83, unit: "%" },
          ],
        },
        {
          id: "ex4",
          name: "Kettlebell Swings",
          completed: false,
          active: false,
          metrics: [
            { name: "Balance", value: 82, unit: "index" },
            { name: "Symmetry", value: 86, unit: "index" },
          ],
        },
      ],
    },
    {
      id: "peak",
      name: "Peak",
      level: "Level 1 (Foundation)",
      exercises: [
        {
          id: "ex5",
          name: "Barbell Deadlift",
          completed: false,
          active: false,
          metrics: [
            { name: "Max Power", value: 92, unit: "index" },
            { name: "Symmetry at Peak", value: 89, unit: "index" },
          ],
        },
      ],
    },
    {
      id: "fatigue",
      name: "Fatigue",
      level: "Level 1 (Foundation)",
      exercises: [
        {
          id: "ex6",
          name: "Back Extensions",
          completed: false,
          active: false,
          metrics: [
            { name: "Balance Loss", value: 15, unit: "%", inverted: true },
            { name: "Symmetry Drift", value: 18, unit: "%", inverted: true },
            { name: "Power Decline", value: 22, unit: "%", inverted: true },
          ],
        },
      ],
    },
    {
      id: "recovery",
      name: "Recovery",
      level: "Level 1 (Foundation)",
      exercises: [
        {
          id: "ex7",
          name: "Pigeon Pose Stretch",
          completed: false,
          active: false,
          metrics: [
            { name: "Balance Restoration", value: 68, unit: "%" },
            { name: "Symmetry Restoration", value: 72, unit: "%" },
          ],
        },
        {
          id: "ex8",
          name: "Foam Rolling",
          completed: false,
          active: false,
          metrics: [{ name: "Recovery Efficiency", value: 75, unit: "index" }],
        },
      ],
    },
  ])

  const [isProgressReportOpen, setIsProgressReportOpen] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhases((prevPhases) =>
        prevPhases.map((phase) => ({
          ...phase,
          exercises: phase.exercises.map((exercise) => ({
            ...exercise,
            metrics: exercise.active
              ? exercise.metrics.map((metric) => ({
                  ...metric,
                  value: generateMetricValue(metric.value, 5),
                }))
              : exercise.metrics,
          })),
        })),
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleExerciseToggle = (phaseId: string, exerciseId: string) => {
    setPhases((prevPhases) =>
      prevPhases.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              exercises: phase.exercises.map((exercise) =>
                exercise.id === exerciseId ? { ...exercise, completed: !exercise.completed } : exercise,
              ),
            }
          : phase,
      ),
    )
  }

  const phaseColors = {
    warmup: "border-l-blue-500",
    performance: "border-l-primary",
    peak: "border-l-success",
    fatigue: "border-l-warning",
    recovery: "border-l-accent",
  }

  const activePhaseId = phases.find((phase) => phase.exercises.some((exercise) => exercise.active))?.id || ""

  const isPhaseCompleted = (phase: Phase) => {
    return phase.exercises.length > 0 && phase.exercises.every((exercise) => exercise.completed)
  }

  return (
    <div className="w-full h-full">
      <div className="sticky top-0 z-10 bg-background/60 backdrop-blur-sm border-b border-border/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground text-balance">Low-Back Mobility Protocol</h1>
            <p className="text-sm text-muted-foreground">Real-time exercise tracking and metrics</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="cursor-pointer" onClick={() => setIsProgressReportOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Progress Report</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Share2 className="mr-2 h-4 w-4" />
                <span>Share Report</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Download className="mr-2 h-4 w-4" />
                <span>Download Report</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <RefreshCw className="mr-2 h-4 w-4" />
                <span>Switch Protocol</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-6 py-6">
        <Accordion type="multiple" defaultValue={[activePhaseId]} className="space-y-4">
          {phases.map((phase) => (
            <AccordionItem
              key={phase.id}
              value={phase.id}
              className={`border-l-4 ${phaseColors[phase.id as keyof typeof phaseColors]} pl-4 border border-border rounded-lg bg-background/90`}
            >
              <AccordionTrigger className="text-lg font-bold text-foreground hover:no-underline px-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <span>{phase.name}</span>
                    {isPhaseCompleted(phase) && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">{phase.level}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-6">
                {phase.exercises.map((exercise) => (
                  <div key={exercise.id} className="space-y-3">
                    {/* Exercise header with checkbox */}
                    <div className="flex items-center gap-3 py-2">
                      <Checkbox
                        id={exercise.id}
                        checked={exercise.completed}
                        onCheckedChange={() => handleExerciseToggle(phase.id, exercise.id)}
                        className="border-2"
                      />
                      <label
                        htmlFor={exercise.id}
                        className={`text-base font-medium cursor-pointer ${
                          exercise.completed
                            ? "line-through text-muted-foreground"
                            : exercise.active
                              ? "text-primary font-semibold"
                              : "text-foreground"
                        }`}
                      >
                        {exercise.name}
                        {exercise.active && (
                          <span className="ml-2 text-xs bg-green-500/20 text-green-700 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </label>
                    </div>

                    {exercise.active && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-8">
                        {exercise.metrics.map((metric, idx) => (
                          <MetricCard
                            key={idx}
                            name={metric.name}
                            value={metric.value}
                            unit={metric.unit}
                            inverted={metric.inverted}
                          />
                        ))}
                      </div>
                    )}

                    {exercise.completed && exercise.insights && (
                      <div className="pl-8 pr-4">
                        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex gap-3">
                          <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-primary mb-1">AI Summary</h4>
                            <p
                              className="text-sm text-foreground/80 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: exercise.insights }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <ProgressReportModal isOpen={isProgressReportOpen} onClose={() => setIsProgressReportOpen(false)} />
    </div>
  )
}
