"use client"

import Link from "next/link"
import { Calendar, Clock, Users, LinkIcon, Video, ChevronRight, User, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"

interface Session {
  id: string
  title: string
  date: Date
  time: string
  type: "1:1" | "group"
  clients: string[]
  link: string
  status: "scheduled" | "completed" | "cancelled"
  sessionOwnerId?: string | null
}

interface SessionDetailsPanelProps {
  session: Session
  onClose: () => void
}

interface ParticipantInfo {
  name: string
  id: string
}

export default function SessionDetailsPanel({ session, onClose }: SessionDetailsPanelProps) {
  const [participantNames, setParticipantNames] = useState<ParticipantInfo[]>([])
  const [coachName, setCoachName] = useState<string | null>(null)
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Check if session is expired (date is before today) or ended (status is completed)
  const isExpired = () => {
    // Check if session status is "completed" (ended)
    if (session.status === "completed") {
      return true
    }
    
    // Check if date is before today
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day
    
    const sessionDate = new Date(session.date)
    sessionDate.setHours(0, 0, 0, 0) // Reset time to start of day
    
    return sessionDate < today
  }

  const handleDownloadSummary = async () => {
    if (!session.id) {
      alert('Session ID is required')
      return
    }

    setIsDownloading(true)
    try {
      const response = await fetch('/api/ai-insights/export-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })

      if (response.ok) {
        // Check if response is PDF
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/pdf')) {
          // Download PDF
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `session-summary-${session.id}-${Date.now()}.pdf`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } else {
          const errorData = await response.json()
          alert(errorData.error || 'Failed to download summary')
        }
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to download summary')
      }
    } catch (error: any) {
      console.error('Error downloading summary:', error)
      alert(error.message || 'Failed to download summary')
    } finally {
      setIsDownloading(false)
    }
  }

  // Fetch participant names and coach name
  useEffect(() => {
    const fetchParticipantInfo = async () => {
      setIsLoadingParticipants(true)
      try {
        // Fetch coach name if sessionOwnerId is available
        if (session.sessionOwnerId) {
          try {
            const coachResponse = await fetch(`/api/participants/${session.sessionOwnerId}?sessionOwnerId=${encodeURIComponent(session.sessionOwnerId)}`)
            if (coachResponse.ok) {
              const coachData = await coachResponse.json()
              setCoachName(coachData.fullName || coachData.firstName || 'Coach')
            }
          } catch (error) {
            console.error('Error fetching coach name:', error)
          }
        }

        // Fetch participant names
        const participantPromises = session.clients.map(async (clientId) => {
          try {
            const url = session.sessionOwnerId 
              ? `/api/participants/${clientId}?sessionOwnerId=${encodeURIComponent(session.sessionOwnerId)}`
              : `/api/participants/${clientId}`
            const response = await fetch(url)
            if (response.ok) {
              const data = await response.json()
              return {
                id: clientId,
                name: data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || clientId,
              }
            }
          } catch (error) {
            console.error(`Error fetching participant ${clientId}:`, error)
          }
          // Fallback to ID if fetch fails
          return {
            id: clientId,
            name: clientId,
          }
        })

        const participants = await Promise.all(participantPromises)
        setParticipantNames(participants)
      } catch (error) {
        console.error('Error fetching participant info:', error)
        // Fallback to IDs if all fetches fail
        setParticipantNames(session.clients.map(id => ({ id, name: id })))
      } finally {
        setIsLoadingParticipants(false)
      }
    }

    if (session.clients.length > 0) {
      fetchParticipantInfo()
    } else {
      setIsLoadingParticipants(false)
    }
  }, [session.clients, session.sessionOwnerId])

  const copyLink = () => {
    const fullLink = `${window.location.origin}${session.link}`
    navigator.clipboard.writeText(fullLink)
    alert("Session link copied to clipboard!")
  }

  return (
    <div className="relative transition-all duration-300 ease-in-out w-full md:w-[40%] border-l border-border bg-muted">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute right-4 md:left-0 md:-translate-x-1/2 top-4 md:top-1/2 md:-translate-y-1/2 z-50 h-10 w-10 md:h-16 md:w-10 rounded-full border-2 border-border bg-background shadow-lg hover:bg-background hover:shadow-xl transition-all"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-muted border-b border-border/30 px-4 md:px-6 py-4 pr-16 md:pr-6 pt-16 md:pt-4">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">{session.title}</h2>
          <Badge variant={session.type === "group" ? "default" : "secondary"} className="mt-2">
            {session.type === "group" ? "Virtual Group Session" : session.type === "mocap" ? "In-Person 1:1 Motion Capture Session" : "Virtual 1:1 Session"}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">
          {/* Coach Name */}
          {coachName && (
            <div className="flex items-start gap-3">
              <User className="size-5 text-muted-foreground mt-1" />
              <div>
                <div className="font-semibold text-foreground">Coach</div>
                <div className="text-muted-foreground">{coachName}</div>
              </div>
            </div>
          )}

          {/* Date and Time */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="size-5 text-muted-foreground mt-1" />
              <div>
                <div className="font-semibold text-foreground">Date</div>
                <div className="text-muted-foreground">{formatDate(session.date)}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="size-5 text-muted-foreground mt-1" />
              <div>
                <div className="font-semibold text-foreground">Time</div>
                <div className="text-muted-foreground">{session.time}</div>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Users className="size-5" />
              <span>Participants ({session.clients.length})</span>
            </div>
            {isLoadingParticipants ? (
              <div className="text-sm text-muted-foreground">Loading participants...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {participantNames.map((participant, index) => (
                  <Badge key={participant.id || index} variant="outline">
                    {participant.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Session Link - Only show for non-expired sessions */}
          {!isExpired() && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <LinkIcon className="size-5" />
                <span>Session Link</span>
              </div>
              <div className="space-y-2">
                <div className="bg-background border border-border rounded-lg p-3 font-mono text-sm break-all">
                  {window.location.origin}
                  {session.link}
                </div>
                <Button variant="outline" onClick={copyLink} className="w-full bg-transparent">
                  Copy Link
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-border">
            {isExpired() ? (
              // Expired session - show download button
              <Button 
                className="w-full gap-2" 
                size="lg"
                onClick={handleDownloadSummary}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="size-5" />
                    Download Session Summary Report
                  </>
                )}
              </Button>
            ) : (
              // Active session - show join button
              <Link href={session.link} className="block">
                <Button className="w-full gap-2" size="lg">
                  <Video className="size-5" />
                  Join Session
                </Button>
              </Link>
            )}
            <Button variant="outline" onClick={onClose} className="w-full bg-transparent" size="lg">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
