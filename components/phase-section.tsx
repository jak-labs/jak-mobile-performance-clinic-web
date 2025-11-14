import type React from "react"
interface PhaseSectionProps {
  title: string
  phase: "warmup" | "performance" | "peak" | "fatigue" | "recovery"
  children: React.ReactNode
}

export default function PhaseSection({ title, phase, children }: PhaseSectionProps) {
  const phaseColors = {
    warmup: "border-l-blue-500",
    performance: "border-l-primary",
    peak: "border-l-success",
    fatigue: "border-l-warning",
    recovery: "border-l-accent",
  }

  return (
    <div className={`border-l-4 ${phaseColors[phase]} pl-4`}>
      <h2 className="text-lg font-bold text-foreground mb-4 sticky top-[73px] bg-background py-2 -mt-2">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}
