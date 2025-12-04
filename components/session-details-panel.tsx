"use client"

import Link from "next/link"
import { Calendar, Clock, Users, LinkIcon, Video, ChevronRight, User, Download, Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [availableClients, setAvailableClients] = useState<Array<{ subject_id: string; name: string; sport?: string }>>([])
  const [selectedClientsToInvite, setSelectedClientsToInvite] = useState<string[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  
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
      // Step 1: Generate and save summary to DB (fast, no PDF generation)
      const response = await fetch('/api/ai-insights/export-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })

      if (response.ok) {
        // Step 2: Download PDF (generated on-demand)
        try {
          const pdfResponse = await fetch(`/api/ai-insights/download-pdf/${session.id}`, {
            method: 'GET',
          })

          if (pdfResponse.ok) {
            const contentType = pdfResponse.headers.get('content-type')
            if (contentType && contentType.includes('application/pdf')) {
              // Download PDF
              const blob = await pdfResponse.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `session-summary-${session.id}-${Date.now()}.pdf`
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
            } else {
              alert('Failed to download PDF - invalid response format')
            }
          } else {
            const contentType = pdfResponse.headers.get('content-type')
            let errorMessage = `Failed to download PDF (${pdfResponse.status})`
            
            try {
              if (contentType && contentType.includes('application/json')) {
                const errorData = await pdfResponse.json()
                errorMessage = errorData.error || errorMessage
              } else {
                const text = await pdfResponse.text()
                console.error('[Session Details] PDF download error response (non-JSON):', text.substring(0, 200))
                errorMessage = `Server error (${pdfResponse.status}): ${pdfResponse.statusText}`
              }
            } catch (parseError) {
              console.error('[Session Details] Error parsing PDF download error response:', parseError)
              errorMessage = `Server error (${pdfResponse.status}): ${pdfResponse.statusText}`
            }
            
            alert(errorMessage)
          }
        } catch (pdfError: any) {
          console.error('[Session Details] Error downloading PDF:', pdfError)
          alert(`Summary generated but PDF download failed: ${pdfError.message || 'Unknown error'}`)
        }
      } else {
        // Handle error response - check content type first
        const contentType = response.headers.get('content-type')
        let errorMessage = `Failed to export summary (${response.status})`
        
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } else {
            // Response might be HTML error page
            const text = await response.text()
            console.error('[Session Details] Error response (non-JSON):', text.substring(0, 200))
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }
        } catch (parseError) {
          console.error('[Session Details] Error parsing error response:', parseError)
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        
        alert(errorMessage)
      }
    } catch (error: any) {
      console.error('Error downloading summary:', error)
      alert(error.message || 'Failed to download summary. Please try again.')
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

  const fetchAvailableClients = async () => {
    setIsLoadingClients(true)
    try {
      const response = await fetch("/api/subjects")
      if (!response.ok) {
        throw new Error("Failed to fetch clients")
      }
      const data = await response.json()
      
      // Map subjects to clients format
      const mappedClients = data.subjects.map((subject: any) => {
        let name = subject.name || 
                   subject.full_name || 
                   (subject.f_name && subject.l_name ? `${subject.f_name} ${subject.l_name}`.trim() : null) ||
                   (subject.first_name && subject.last_name ? `${subject.first_name} ${subject.last_name}`.trim() : null) ||
                   subject.f_name || 
                   subject.first_name ||
                   "Unknown"
        
        let sport = subject.sport || subject.sport_type || ""
        
        return {
          subject_id: subject.subject_id || subject.id,
          name: name,
          sport: sport,
        }
      })

      // Filter out clients that are already participants
      // Normalize IDs to strings for comparison
      const existingClientIds = new Set(session.clients.map((id: string) => String(id).trim()))
      const available = mappedClients.filter((client: any) => {
        const clientId = String(client.subject_id || client.id || '').trim()
        return clientId && !existingClientIds.has(clientId)
      })
      
      console.log('[Invite] Existing participants:', Array.from(existingClientIds))
      console.log('[Invite] Available clients after filtering:', available.length)
      
      setAvailableClients(available)
      setSelectedClientsToInvite([])
    } catch (err: any) {
      console.error("Error fetching clients:", err)
      alert(err.message || "Failed to load clients")
    } finally {
      setIsLoadingClients(false)
    }
  }

  const toggleClientSelection = (clientId: string) => {
    setSelectedClientsToInvite((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    )
  }

  const handleInviteParticipants = async () => {
    if (selectedClientsToInvite.length === 0) {
      alert("Please select at least one client to invite")
      return
    }

    setIsInviting(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectIds: selectedClientsToInvite }),
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        alert(`Server error: Received ${response.status} ${response.statusText}. Please check the console for details.`)
        return
      }

      const data = await response.json()

      if (response.ok) {
        alert(`Successfully invited ${data.invited} participant(s)${data.failed > 0 ? `. ${data.failed} invitation(s) failed.` : ''}`)
        setIsInviteDialogOpen(false)
        setSelectedClientsToInvite([])
        // Refresh the page or update session data to show new participants
        window.location.reload()
      } else {
        alert(data.error || 'Failed to invite participants')
      }
    } catch (error: any) {
      console.error('Error inviting participants:', error)
      alert(error.message || 'Failed to invite participants')
    } finally {
      setIsInviting(false)
    }
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Users className="size-5" />
                <span>Participants ({session.clients.length})</span>
              </div>
              {!isExpired() && session.type === "group" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsInviteDialogOpen(true)
                    fetchAvailableClients()
                  }}
                  className="gap-2"
                >
                  <UserPlus className="size-4" />
                  Invite More
                </Button>
              )}
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

      {/* Invite Participants Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite Additional Participants</DialogTitle>
            <DialogDescription>
              Select clients to invite to this session. They will receive an email invitation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {isLoadingClients ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading clients...</p>
              </div>
            ) : availableClients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No additional clients available to invite</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availableClients.map((client) => (
                  <div
                    key={client.subject_id}
                    className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`invite-${client.subject_id}`}
                      checked={selectedClientsToInvite.includes(client.subject_id)}
                      onCheckedChange={() => toggleClientSelection(client.subject_id)}
                    />
                    <Label
                      htmlFor={`invite-${client.subject_id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{client.name}</div>
                      {client.sport && (
                        <div className="text-xs text-muted-foreground">{client.sport}</div>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setIsInviteDialogOpen(false)
                  setSelectedClientsToInvite([])
                }}
                className="flex-1"
                disabled={isInviting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInviteParticipants}
                className="flex-1"
                disabled={isInviting || selectedClientsToInvite.length === 0 || isLoadingClients}
              >
                {isInviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inviting...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite {selectedClientsToInvite.length > 0 ? `(${selectedClientsToInvite.length})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
