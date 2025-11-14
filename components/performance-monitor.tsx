"use client"
import VideoSession from "./video-session"
import GroupVideoSession from "./group-video-session"
import type { Session } from "@/lib/sessions-data"

interface PerformanceMonitorProps {
  subjectId: string
  session?: Session
}

export default function PerformanceMonitor({ subjectId, session }: PerformanceMonitorProps) {
  const isGroupSession = session?.type === "group"

  // The metrics are now integrated into VideoSession and GroupVideoSession components with tabs
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {isGroupSession ? <GroupVideoSession participants={session?.clients || []} /> : <VideoSession />}
    </div>
  )
}
