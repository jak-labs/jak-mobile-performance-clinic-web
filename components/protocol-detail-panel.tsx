"use client"

import { ChevronRight, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface Protocol {
  name: string
  purpose: string
}

interface Exercise {
  id: string
  name: string
  sets?: string
  reps?: string
  duration?: string
  notes?: string
}

interface Phase {
  id: string
  name: string
  level: string
  exercises: Exercise[]
}

interface ProtocolDetailPanelProps {
  protocol: Protocol | null
  isOpen: boolean
  onToggle: () => void
}

// Mock data for protocol phases and exercises
const getProtocolPhases = (protocolName: string): Phase[] => {
  // Return different phases based on protocol type
  if (protocolName.includes("Mobility")) {
    return [
      {
        id: "warmup",
        name: "Warm-Up",
        level: "Level 1 (Foundation)",
        exercises: [
          {
            id: "ex1",
            name: "Dynamic Hip Flexor Stretch",
            sets: "2",
            reps: "10 each side",
            notes: "Focus on controlled movement",
          },
          {
            id: "ex2",
            name: "Cat-Cow Stretch",
            sets: "3",
            reps: "15",
            notes: "Emphasize spinal articulation",
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
            name: "Bird Dog",
            sets: "3",
            reps: "12 each side",
            notes: "Maintain neutral spine throughout",
          },
          {
            id: "ex4",
            name: "Dead Bug",
            sets: "3",
            reps: "10 each side",
            notes: "Keep lower back pressed to floor",
          },
        ],
      },
      {
        id: "recovery",
        name: "Recovery",
        level: "Level 1 (Foundation)",
        exercises: [
          {
            id: "ex5",
            name: "Child's Pose",
            duration: "2 minutes",
            notes: "Focus on deep breathing",
          },
          {
            id: "ex6",
            name: "Foam Rolling - Lower Back",
            duration: "3 minutes",
            notes: "Gentle pressure, avoid direct spine contact",
          },
        ],
      },
    ]
  } else if (protocolName.includes("Strength")) {
    return [
      {
        id: "warmup",
        name: "Warm-Up",
        level: "Level 1 (Foundation)",
        exercises: [
          {
            id: "ex1",
            name: "Glute Bridges",
            sets: "2",
            reps: "15",
            notes: "Activate glutes and core",
          },
          {
            id: "ex2",
            name: "Plank Hold",
            sets: "2",
            duration: "30 seconds",
            notes: "Maintain neutral alignment",
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
            name: "Romanian Deadlift",
            sets: "4",
            reps: "8-10",
            notes: "Focus on hip hinge pattern",
          },
          {
            id: "ex4",
            name: "Single-Leg RDL",
            sets: "3",
            reps: "8 each leg",
            notes: "Maintain balance and control",
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
            sets: "3",
            reps: "5",
            notes: "Progressive overload, proper form priority",
          },
        ],
      },
      {
        id: "recovery",
        name: "Recovery",
        level: "Level 1 (Foundation)",
        exercises: [
          {
            id: "ex6",
            name: "Static Stretching",
            duration: "5 minutes",
            notes: "Target hamstrings, glutes, and lower back",
          },
        ],
      },
    ]
  } else {
    // Default generic protocol structure
    return [
      {
        id: "warmup",
        name: "Warm-Up",
        level: "Level 1 (Foundation)",
        exercises: [
          {
            id: "ex1",
            name: "Dynamic Stretching",
            sets: "2",
            reps: "10",
            notes: "Prepare muscles and joints",
          },
        ],
      },
      {
        id: "performance",
        name: "Performance",
        level: "Level 1 (Foundation)",
        exercises: [
          {
            id: "ex2",
            name: "Main Exercise",
            sets: "3",
            reps: "10-12",
            notes: "Focus on proper form and technique",
          },
        ],
      },
      {
        id: "recovery",
        name: "Recovery",
        level: "Level 1 (Foundation)",
        exercises: [
          {
            id: "ex3",
            name: "Cool Down",
            duration: "5 minutes",
            notes: "Gentle movement and stretching",
          },
        ],
      },
    ]
  }
}

const phaseColors = {
  warmup: "border-l-blue-500",
  performance: "border-l-primary",
  peak: "border-l-success",
  fatigue: "border-l-warning",
  recovery: "border-l-accent",
}

export default function ProtocolDetailPanel({ protocol, isOpen, onToggle }: ProtocolDetailPanelProps) {
  if (!protocol) return null

  const phases = getProtocolPhases(protocol.name)

  return (
    <div
      className={`relative transition-all duration-300 ease-in-out ${
        isOpen ? "w-[40%]" : "w-0"
      } border-l border-border bg-muted`}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 z-50 h-16 w-10 rounded-full border-2 border-border bg-background shadow-lg hover:bg-background hover:shadow-xl transition-all"
      >
        {isOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>

      <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="sticky top-0 z-10 bg-muted border-b border-border/30 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground text-balance">{protocol.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{protocol.purpose}</p>
          </div>
        </div>

        <div className="px-6 py-6 pb-8">
          <Accordion type="multiple" defaultValue={[]} className="space-y-4">
            {phases.map((phase, index) => (
              <AccordionItem
                key={phase.id}
                value={phase.id}
                className={`border-l-4 ${phaseColors[phase.id as keyof typeof phaseColors]} pl-4 border border-border rounded-lg bg-background/90 ${
                  index === phases.length - 1 ? "mb-2" : ""
                }`}
              >
                <AccordionTrigger className="text-lg font-bold text-foreground hover:no-underline px-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      <span>{phase.name}</span>
                    </div>
                    <span className="text-sm font-normal text-muted-foreground">{phase.level}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-4">
                  {phase.exercises.map((exercise) => (
                    <div key={exercise.id} className="p-4 rounded-lg bg-background/80 border border-border/50">
                      <h4 className="font-semibold text-base mb-2">{exercise.name}</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {exercise.sets && (
                          <p>
                            <span className="font-medium">Sets:</span> {exercise.sets}
                          </p>
                        )}
                        {exercise.reps && (
                          <p>
                            <span className="font-medium">Reps:</span> {exercise.reps}
                          </p>
                        )}
                        {exercise.duration && (
                          <p>
                            <span className="font-medium">Duration:</span> {exercise.duration}
                          </p>
                        )}
                        {exercise.notes && (
                          <p className="mt-2 text-foreground/70">
                            <span className="font-medium">Notes:</span> {exercise.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
