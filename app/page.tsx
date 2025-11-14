"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import ScheduleContent from "@/components/schedule-content"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated")

    if (!isAuthenticated || isAuthenticated !== "true") {
      router.push("/sign-in")
    }
  }, [router])

  const isAuthenticated = typeof window !== "undefined" && localStorage.getItem("isAuthenticated") === "true"

  if (!isAuthenticated) {
    return null
  }

  return <ScheduleContent />
}
