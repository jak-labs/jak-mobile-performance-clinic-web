"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import ScheduleSessionPanel from "@/components/schedule-session-panel"
import SessionDetailsPanel from "@/components/session-details-panel"
import { getAllSessions, addSession as addGlobalSession, type Session } from "@/lib/sessions-data"

export default function ScheduleContent() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isSchedulePanelOpen, setIsSchedulePanelOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessions, setSessions] = useState<Session[]>(getAllSessions())

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek }
  }

  const getSessionsForDate = (date: Date) => {
    return sessions.filter((session) => {
      const sessionDate = new Date(session.date)
      return (
        sessionDate.getDate() === date.getDate() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getFullYear() === date.getFullYear()
      )
    })
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const handleAddSession = (newSession: Omit<Session, "id" | "link" | "status">) => {
    const sessionId = Math.random().toString(36).substring(2, 9)
    const session: Session = {
      ...newSession,
      id: sessionId,
      link: `/session/${sessionId}`,
      status: "scheduled",
    }
    addGlobalSession(session)
    setSessions((prev) => [...prev, session])
    setIsSchedulePanelOpen(false)
  }

  const handleOpenSchedulePanel = () => {
    setSelectedSession(null)
    setIsSchedulePanelOpen(true)
  }

  const handleSelectSession = (session: Session) => {
    setIsSchedulePanelOpen(false)
    setSelectedSession(session)
  }

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: startingDayOfWeek }, (_, i) => i)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main content */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isSchedulePanelOpen || selectedSession ? "w-[60%]" : "w-full"
        } flex flex-col`}
      >
        {/* Header */}
        <div className="p-3 pl-20 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
                <ChevronRight className="size-4" />
              </Button>
              <Button onClick={handleOpenSchedulePanel} size="default" className="gap-2 ml-2">
                <Plus className="size-4" />
                Schedule
              </Button>
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <h2 className="text-lg font-semibold text-foreground mb-3">Performance Clinic Calendar</h2>

            {/* Legend */}
            <div className="flex gap-4 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground">1:1 Session</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-xs text-muted-foreground">Group Session</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr gap-px flex-1 min-h-0 bg-border/30 rounded-lg overflow-hidden">
              {/* Day headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center font-semibold text-xs text-muted-foreground py-1 bg-muted/50 flex items-center justify-center"
                >
                  {day}
                </div>
              ))}

              {/* Empty cells for days before month starts */}
              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="bg-muted/20" />
              ))}

              {/* Calendar days */}
              {days.map((day) => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                const daySessions = getSessionsForDate(date)
                const isToday =
                  date.getDate() === new Date().getDate() &&
                  date.getMonth() === new Date().getMonth() &&
                  date.getFullYear() === new Date().getFullYear()

                const visibleSessions = daySessions.slice(0, 4)
                const remainingSessions = daySessions.length - visibleSessions.length

                return (
                  <div
                    key={day}
                    className={`p-1.5 flex flex-col overflow-hidden ${isToday ? "bg-primary/5" : "bg-background"}`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5 overflow-hidden flex-1">
                      {visibleSessions.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => handleSelectSession(session)}
                          className="w-full text-left px-1.5 py-0.5 rounded text-[11px] transition-colors hover:opacity-80 flex items-center gap-1.5 group"
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              session.type === "1:1" ? "bg-blue-500" : "bg-purple-500"
                            }`}
                          />
                          <span className="text-muted-foreground flex-shrink-0">{session.time}</span>
                          <span className="truncate font-medium text-foreground">{session.title}</span>
                        </button>
                      ))}
                      {remainingSessions > 0 && (
                        <div className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                          {remainingSessions} more event{remainingSessions > 1 ? "s" : ""}...
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Session Panel */}
      {isSchedulePanelOpen && (
        <ScheduleSessionPanel
          isOpen={isSchedulePanelOpen}
          onClose={() => setIsSchedulePanelOpen(false)}
          onAddSession={handleAddSession}
        />
      )}

      {/* Session Details Panel */}
      {selectedSession && <SessionDetailsPanel session={selectedSession} onClose={() => setSelectedSession(null)} />}
    </div>
  )
}
