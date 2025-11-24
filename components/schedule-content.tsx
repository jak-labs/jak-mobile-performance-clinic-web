"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import ScheduleSessionPanel from "@/components/schedule-session-panel"
import SessionDetailsPanel from "@/components/session-details-panel"
import { type Session } from "@/lib/sessions-data"
import { useSession } from "next-auth/react"

export default function ScheduleContent() {
  const { data: session } = useSession()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isSchedulePanelOpen, setIsSchedulePanelOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isCoach, setIsCoach] = useState(true) // Default to coach, will be updated
  const [userFirstName, setUserFirstName] = useState<string>("")
  const [selectedDaySessions, setSelectedDaySessions] = useState<{ date: Date; sessions: Session[] } | null>(null)

  // Fetch user groups and profile to determine role and get first name
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!session?.user?.id) return
      
      try {
        // Fetch user groups to determine role
        const groupsResponse = await fetch("/api/auth/user-groups")
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json()
          setIsCoach(groupsData.isCoach || false)
          
          // Fetch user profile to get first name
          let firstName = ""
          
          if (groupsData.isCoach) {
            // For coaches, get from jak-users table
            const profileResponse = await fetch("/api/user/profile")
            if (profileResponse.ok) {
              const profileData = await profileResponse.json()
              console.log('Coach profile data:', profileData)
              // Try f_name first, then fullName, then email
              firstName = profileData.user?.f_name || 
                          (profileData.user?.fullName ? profileData.user.fullName.split(" ")[0] : "") ||
                          (profileData.user?.email ? profileData.user.email.split("@")[0] : "")
              console.log('Extracted first name for coach:', firstName, 'from f_name:', profileData.user?.f_name, 'fullName:', profileData.user?.fullName, 'email:', profileData.user?.email)
            } else {
              console.error('Failed to fetch coach profile:', profileResponse.status, profileResponse.statusText)
              // Fallback: extract first name from session user name, or from email (part before @)
              if (session?.user?.name && !session.user.name.includes("@")) {
                // If name exists and is not an email, use it
                firstName = session.user.name.split(" ")[0]
              } else if (session?.user?.email) {
                // Extract from email (part before @)
                firstName = session.user.email.split("@")[0]
              } else if (session?.user?.name) {
                // If name is an email address, extract from it
                firstName = session.user.name.split("@")[0]
              }
            }
          } else {
            // For members, get from jak-subjects table
            const profileResponse = await fetch(`/api/subjects/${session.user.id}`)
            if (profileResponse.ok) {
              const profileData = await profileResponse.json()
              console.log('Member profile data:', profileData)
              firstName = profileData.subject?.first_name || 
                         profileData.subject?.f_name || 
                         profileData.subject?.full_name?.split(" ")[0] || 
                         profileData.subject?.name?.split(" ")[0] ||
                         profileData.subject?.email?.split("@")[0] || 
                         ""
              console.log('Extracted first name for member:', firstName)
            } else {
              console.error('Failed to fetch member profile:', profileResponse.status, profileResponse.statusText)
              // Fallback to session user name or email
              firstName = session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || ""
            }
          }
          
          // Set first name if we have one
          if (firstName) {
            setUserFirstName(firstName)
          }
        }
      } catch (error) {
        console.error("Error fetching user info:", error)
      }
    }
    if (session) {
      fetchUserInfo()
    }
  }, [session])

  // Fetch sessions from DynamoDB on component mount and when month changes
  useEffect(() => {
    if (session) {
      fetchSessions()
    }
  }, [currentDate, session])

  const fetchSessions = async () => {
    setIsLoadingSessions(true)
    try {
      // Calculate date range - fetch current month for calendar, but extend to 6 months ahead for upcoming sessions list
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const startDate = new Date(year, month, 1).toISOString()
      // Extend end date to 6 months ahead to ensure we have upcoming sessions for the list view
      const endDate = new Date(year, month + 6, 0, 23, 59, 59, 999).toISOString()

      const response = await fetch(`/api/sessions?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch sessions")
      }

      const data = await response.json()
      
      // Convert DynamoDB sessions to the Session format expected by the UI
      const convertedSessions: Session[] = data.sessions.map((dbSession: any) => {
        const sessionDate = new Date(dbSession.session_date_time)
        
        // Format time as HH:MM
        const hours = sessionDate.getHours()
        const minutes = sessionDate.getMinutes()
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        
        // Get client names from subject_id or subject_ids
        const clients: string[] = []
        if (dbSession.subject_id) {
          // For single sessions, we'd need to look up the client name
          // For now, just use the subject_id
          clients.push(dbSession.subject_id)
        }
        if (dbSession.subject_ids && Array.isArray(dbSession.subject_ids)) {
          clients.push(...dbSession.subject_ids)
        }
        
        return {
          id: dbSession.session_id,
          title: dbSession.title,
          date: sessionDate,
          time: timeString,
          type: dbSession.session_type === "single" ? "1:1" : dbSession.session_type === "mocap" ? "mocap" : "group",
          clients: clients,
          link: `/session/${dbSession.session_id}`,
          status: dbSession.status || "scheduled",
          sessionOwnerId: dbSession.user_id || null, // Add session owner ID for fetching coach name
        }
      })

      setSessions(convertedSessions)
    } catch (error) {
      console.error("Error fetching sessions:", error)
      // Don't show error to user, just log it
    } finally {
      setIsLoadingSessions(false)
    }
  }

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
    const daySessions = sessions.filter((session) => {
      const sessionDate = new Date(session.date)
      return (
        sessionDate.getDate() === date.getDate() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getFullYear() === date.getFullYear()
      )
    })
    
    // Sort by time (most recent/latest time first - descending)
    return daySessions.sort((a, b) => {
      const timeA = a.time.split(':').map(Number)
      const timeB = b.time.split(':').map(Number)
      const minutesA = timeA[0] * 60 + timeA[1]
      const minutesB = timeB[0] * 60 + timeB[1]
      return minutesB - minutesA // Descending order (latest first)
    })
  }

  const getUpcomingSessions = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    return sessions
      .filter((session) => {
        if (!session || !session.date) {
          return false
        }
        
        let sessionDate: Date
        if (session.date instanceof Date) {
          sessionDate = session.date
        } else if (typeof session.date === 'string') {
          sessionDate = new Date(session.date)
        } else {
          return false
        }
        
        if (isNaN(sessionDate.getTime())) {
          return false
        }
        
        const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate())
        // Include sessions that are today or in the future, OR from the current month
        const isTodayOrFuture = sessionDay >= today
        const isCurrentMonth = sessionDate >= currentMonthStart && 
                              sessionDate.getMonth() === now.getMonth() && 
                              sessionDate.getFullYear() === now.getFullYear()
        const isUpcoming = isTodayOrFuture || isCurrentMonth
        
        return isUpcoming
      })
      .sort((a, b) => {
        // Sort in descending order (most recent first)
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })
  }

  const formatSessionDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sessionDate = new Date(date)
    sessionDate.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (sessionDate.getTime() === today.getTime()) {
      return "Today"
    } else if (sessionDate.getTime() === tomorrow.getTime()) {
      return "Tomorrow"
    } else {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      
      const dayOfWeek = dayNames[date.getDay()]
      const month = monthNames[date.getMonth()]
      const day = date.getDate()
      
      // If within the next 7 days, show day name, otherwise show full date
      const daysDiff = Math.floor((sessionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff <= 7) {
        return `${dayOfWeek}, ${month} ${day}`
      } else {
        return `${month} ${day}, ${date.getFullYear()}`
      }
    }
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

  const handleAddSession = (newSession: Session) => {
    // Add to local state immediately for instant feedback
    setSessions((prev) => {
      // Check if session already exists to prevent duplicates
      const exists = prev.some((s) => s.id === newSession.id)
      if (exists) {
        return prev
      }
      return [...prev, newSession]
    })
    setIsSchedulePanelOpen(false)
    
    // Optionally refresh from database to ensure consistency
    // But we'll let the useEffect handle it naturally
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
          isSchedulePanelOpen || selectedSession 
            ? "hidden md:flex w-[60%]" 
            : "w-full"
        } flex flex-col`}
      >
        {/* User Role Header - Show at the very top, above everything */}
        <div className="p-3 md:pl-20 pt-20 md:pt-4">
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            {userFirstName 
              ? `${isCoach ? "JAK Coach" : "JAK Member"}: ${userFirstName}`
              : isCoach 
                ? "JAK Coach" 
                : "JAK Member"}
          </h2>
        </div>
        
        {/* Header */}
        <div className="px-3 md:pl-20 pb-3 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-foreground truncate">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h1>
            </div>
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => navigateMonth("prev")}>
                <ChevronLeft className="size-3 md:size-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => navigateMonth("next")}>
                <ChevronRight className="size-3 md:size-4" />
              </Button>
              {isCoach && (
                <Button onClick={handleOpenSchedulePanel} size="sm" className="gap-1 md:gap-2 text-xs md:text-sm h-8 md:h-10 px-2 md:px-4">
                  <Plus className="size-3 md:size-4" />
                  <span className="hidden sm:inline">Schedule</span>
                </Button>
              )}
            </div>
          </div>

          {/* Calendar / Sessions List */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <h2 className="text-base md:text-lg font-semibold text-foreground mb-3">Performance Clinic Calendar</h2>

            {/* Mobile: Upcoming Sessions List */}
            <div className="block md:hidden flex-1 min-h-0 overflow-hidden">
              {isLoadingSessions ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading sessions...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {(() => {
                    const upcomingSessions = getUpcomingSessions()
                    if (upcomingSessions.length === 0) {
                      return (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-2">No upcoming sessions</p>
                            {sessions.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {sessions.length} total session{sessions.length !== 1 ? 's' : ''} found
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div className="space-y-3 pb-4">
                        {upcomingSessions.map((session) => {
                          const sessionDate = new Date(session.date)
                          return (
                            <button
                              key={session.id}
                              onClick={() => handleSelectSession(session)}
                              className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                                    session.type === "1:1" ? "bg-blue-500" : "bg-purple-500"
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-foreground">
                                      {formatSessionDate(sessionDate)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">•</span>
                                    <span className="text-sm text-muted-foreground">{session.time}</span>
                                  </div>
                                  <h3 className="text-base font-medium text-foreground mb-1">{session.title}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {session.type === "1:1" ? "Virtual 1:1 Session" : session.type === "mocap" ? "In-Person 1:1 Motion Capture Session" : "Virtual Group Session"}
                                  </p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Desktop: Calendar Grid */}
            <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Legend */}
              <div className="flex gap-4 mb-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">Virtual 1:1 Session</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-xs text-muted-foreground">Virtual Group Session</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-xs text-muted-foreground">In-Person Motion Capture</span>
                </div>
              </div>

              {/* Calendar Grid */}
              {isLoadingSessions ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading sessions...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-7 auto-rows-fr gap-px flex-1 min-h-0 bg-border/30 rounded-lg overflow-hidden">
                  {/* Day headers */}
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="text-center font-semibold text-[10px] text-muted-foreground bg-muted/50 flex items-center justify-center"
                      style={{ padding: '1px 0', minHeight: 'auto', lineHeight: '1.2' }}
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

                    // Show only 2 sessions (most recent first)
                    const visibleSessions = daySessions.slice(0, 2)
                    const hasMoreSessions = daySessions.length > 2

                    return (
                      <div
                        key={day}
                        className={`p-1.5 flex flex-col ${isToday ? "bg-primary/5" : "bg-background"}`}
                      >
                        <div className={`text-xs font-semibold mb-1 flex-shrink-0 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                          {day}
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col">
                          {/* Sessions list - scrollable if needed */}
                          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-0.5">
                            {visibleSessions.map((session) => (
                              <button
                                key={session.id}
                                onClick={() => handleSelectSession(session)}
                                className="w-full text-left px-1.5 py-0.5 rounded text-[11px] transition-colors hover:opacity-80 flex items-center gap-1.5 group"
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    session.type === "1:1" ? "bg-blue-500" : session.type === "mocap" ? "bg-orange-500" : "bg-purple-500"
                                  }`}
                                />
                                <span className="text-muted-foreground flex-shrink-0">{session.time}</span>
                                <span className="truncate font-medium text-foreground">{session.title}</span>
                              </button>
                            ))}
                          </div>
                          {/* "+ More" button - always visible, never cut off */}
                          {hasMoreSessions && (
                            <button
                              onClick={() => setSelectedDaySessions({ date, sessions: daySessions })}
                              className="w-full text-left px-1.5 py-0.5 rounded text-[10px] transition-colors hover:opacity-80 flex items-center gap-1.5 group text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
                            >
                              <Plus className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="text-[9px] whitespace-nowrap">{daySessions.length - 2} more</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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

      {/* Day Sessions Dialog */}
      <Dialog open={selectedDaySessions !== null} onOpenChange={(open) => !open && setSelectedDaySessions(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDaySessions && (
                <>
                  Sessions for {selectedDaySessions.date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {selectedDaySessions?.sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  handleSelectSession(session)
                  setSelectedDaySessions(null)
                }}
                className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                      session.type === "1:1" ? "bg-blue-500" : session.type === "mocap" ? "bg-orange-500" : "bg-purple-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{session.time}</span>
                    </div>
                    <h3 className="text-base font-medium text-foreground mb-1">{session.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {session.type === "1:1" ? "Virtual 1:1 Session" : session.type === "mocap" ? "In-Person 1:1 Motion Capture Session" : "Virtual Group Session"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
