"use client"

import { useParams } from "next/navigation"
import PerformanceMonitor from "@/components/performance-monitor"
import { getSessionById } from "@/lib/sessions-data"

export default function SessionPage() {
  const params = useParams()
  const id = params.id as string
  const session = getSessionById(id)

  console.log("[v0] Session page - ID:", id)
  console.log("[v0] Session page - Found session:", session)

  return <PerformanceMonitor subjectId={id} session={session} />
}
