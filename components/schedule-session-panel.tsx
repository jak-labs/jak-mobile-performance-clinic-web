"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { ChevronRight, Calendar, Users, LinkIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type Session } from "@/lib/sessions-data"

interface ScheduleSessionPanelProps {
  isOpen: boolean
  onClose: () => void
  onAddSession: (session: Session) => void
}

interface Client {
  subject_id: string
  name: string
  sport?: string
  [key: string]: any
}

export default function ScheduleSessionPanel({ isOpen, onClose, onAddSession }: ScheduleSessionPanelProps) {
  const [formData, setFormData] = useState({
    title: "",
    sessionType: "virtual-1:1",
    date: "",
    time: "",
    duration: "60",
    notes: "",
    selectedClients: [] as string[],
  })

  const [clients, setClients] = useState<Client[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [generatedLink, setGeneratedLink] = useState("")

  // Fetch clients when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchClients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const fetchClients = async () => {
    setIsLoadingClients(true)
    setError("")
    try {
      const response = await fetch("/api/subjects")
      if (!response.ok) {
        throw new Error("Failed to fetch clients")
      }
      const data = await response.json()
      console.log("Subjects data:", data.subjects) // Debug log
      
      // Map subjects to clients format - handle various field name possibilities
      const mappedClients = data.subjects.map((subject: any) => {
        // Try different field name variations for name
        let name = subject.name || 
                   subject.full_name || 
                   (subject.f_name && subject.l_name ? `${subject.f_name} ${subject.l_name}`.trim() : null) ||
                   (subject.first_name && subject.last_name ? `${subject.first_name} ${subject.last_name}`.trim() : null) ||
                   subject.f_name || 
                   subject.first_name ||
                   subject.l_name ||
                   subject.last_name ||
                   "Unknown"
        
        // Try different field name variations for sport
        let sport = subject.sport || 
                    subject.sport_type || 
                    subject.activity || 
                    ""
        
        return {
          subject_id: subject.subject_id || subject.id,
          name: name,
          sport: sport,
        }
      })
      setClients(mappedClients)
    } catch (err: any) {
      setError(err.message || "Failed to load clients")
      console.error("Error fetching clients:", err)
    } finally {
      setIsLoadingClients(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    if (formData.selectedClients.length === 0) {
      setError("Please select at least one client")
      setIsSubmitting(false)
      return
    }

    // Handle "Start Now" option - use current time
    let sessionTime = formData.time
    let sessionDate = formData.date
    
    if (formData.time === "now") {
      const now = new Date()
      sessionTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      sessionDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
    }

    try {
      const response = await fetch("/api/sessions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          date: sessionDate,
          time: sessionTime,
          duration: formData.duration,
          sessionType: formData.sessionType === "virtual-1:1" ? "single" : formData.sessionType === "virtual-group" ? "group" : "mocap",
          subjectIds: formData.selectedClients,
          notes: formData.notes || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create session")
      }

      // Get client names for the callback
      const clientNames = clients
        .filter((client) => formData.selectedClients.includes(client.subject_id))
        .map((client) => client.name)

      // Parse date and time to create a Date object for the callback
      const [year, month, day] = sessionDate.split("-").map(Number)
      const [hours, minutes] = sessionTime.split(":").map(Number)
      const sessionDateObj = new Date(year, month - 1, day, hours, minutes)

      // Format time for display (HH:MM)
      const timeString = sessionTime

      // Use the session_id from the API response
      const newSession = {
        id: data.session_id,
        title: formData.title,
        date: sessionDateObj,
        time: timeString,
        type: formData.sessionType === "virtual-1:1" ? "1:1" : formData.sessionType === "virtual-group" ? "group" : "mocap",
        clients: clientNames,
        link: `/session/${data.session_id}`,
        status: "scheduled" as const,
      }
      
      onAddSession(newSession)

      // Reset form
      setFormData({
        title: "",
        sessionType: "virtual-1:1",
        date: "",
        time: "",
        duration: "60",
        notes: "",
        selectedClients: [],
      })
      setGeneratedLink("")
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to create session")
      console.error("Error creating session:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleClient = (clientId: string) => {
    if (formData.sessionType === "virtual-1:1" || formData.sessionType === "mocap-1:1") {
      // For 1:1 sessions (virtual or mocap), replace the selection with the new client
      setFormData((prev) => ({
        ...prev,
        selectedClients: prev.selectedClients.includes(clientId) ? [] : [clientId],
      }))
    } else {
      // For group sessions, allow multiple selections
      setFormData((prev) => ({
        ...prev,
        selectedClients: prev.selectedClients.includes(clientId)
          ? prev.selectedClients.filter((id) => id !== clientId)
          : [...prev.selectedClients, clientId],
      }))
    }
  }

  // Reset selected clients when session type changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      selectedClients: [],
    }))
  }, [formData.sessionType])

  return (
    <div
      className={`relative transition-all duration-300 ease-in-out ${
        isOpen ? "w-full md:w-[40%]" : "w-0"
      } border-l border-border bg-muted`}
    >
      {isOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-4 md:left-0 md:-translate-x-1/2 top-4 md:top-1/2 md:-translate-y-1/2 z-50 h-10 w-10 md:h-16 md:w-10 rounded-full border-2 border-border bg-background shadow-lg hover:bg-background hover:shadow-xl transition-all"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}

      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-muted border-b border-border/30 px-4 md:px-6 py-4 pr-16 md:pr-6 pt-16 md:pt-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Schedule Session</h2>
            <p className="text-sm text-muted-foreground mt-1">Create a new coaching session</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Session Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Calendar className="size-5" />
                <h3>Session Details</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Session Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Performance Training, Recovery Session"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Session Type *</Label>
                <RadioGroup
                  value={formData.sessionType}
                  onValueChange={(value) => handleInputChange("sessionType", value)}
                >
                  <div className="flex items-center space-x-3 border border-border dark:border-gray-400/50 rounded-lg p-3">
                    <RadioGroupItem value="virtual-1:1" id="virtual-one-on-one" />
                    <Label htmlFor="virtual-one-on-one" className="flex-1 cursor-pointer">
                      Virtual 1:1 Session
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 border border-border dark:border-gray-400/50 rounded-lg p-3">
                    <RadioGroupItem value="virtual-group" id="virtual-group" />
                    <Label htmlFor="virtual-group" className="flex-1 cursor-pointer">
                      Virtual Group Session
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 border border-border dark:border-gray-400/50 rounded-lg p-3">
                    <RadioGroupItem value="mocap-1:1" id="mocap-one-on-one" />
                    <Label htmlFor="mocap-one-on-one" className="flex-1 cursor-pointer">
                      In-Person 1:1 Motion Capture Session
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  <Select
                    value={formData.time}
                    onValueChange={(value) => handleInputChange("time", value)}
                    required
                  >
                    <SelectTrigger id="time" className="w-full">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {(() => {
                        const timeOptions: Array<{ value: string; label: string }> = []
                        
                        // Add "Start Now" as first option
                        timeOptions.push({ value: "now", label: "Start Now" })
                        
                        // Generate time options from 5am to 10pm (5:00 to 22:00)
                        for (let hour = 5; hour <= 22; hour++) {
                          for (let minute = 0; minute < 60; minute += 15) {
                            // Skip times after 10pm (22:00)
                            if (hour === 22 && minute > 0) break
                            
                            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                            const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })
                            timeOptions.push({ value: timeString, label: displayTime })
                          }
                        }
                        return timeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duration *</Label>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 60, 90, 120].map((minutes) => (
                    <Button
                      key={minutes}
                      type="button"
                      variant={formData.duration === minutes.toString() ? "default" : "outline"}
                      onClick={() => handleInputChange("duration", minutes.toString())}
                      className="flex-1 min-w-[80px]"
                    >
                      {minutes} Min
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Session Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes or instructions for this session"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Client Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Users className="size-5" />
                <h3>Select Clients *</h3>
              </div>

              <p className="text-sm text-muted-foreground">
                {formData.sessionType === "virtual-1:1" || formData.sessionType === "mocap-1:1"
                  ? formData.sessionType === "mocap-1:1"
                    ? "Select one client for this In-Person Motion Capture session"
                    : "Select one client for this 1:1 session"
                  : "Select multiple clients for this group session"}
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto border border-border dark:border-gray-400/50 rounded-lg p-3">
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading clients...</span>
                  </div>
                ) : clients.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No clients found. Please add clients first.
                  </div>
                ) : (
                  clients.map((client) => {
                    const isSelected = formData.selectedClients.includes(client.subject_id)
                    const isDisabled =
                      (formData.sessionType === "virtual-1:1" || formData.sessionType === "mocap-1:1") && formData.selectedClients.length > 0 && !isSelected

                    return (
                      <div
                        key={client.subject_id}
                        className={`flex items-center space-x-3 p-2 hover:bg-accent/50 rounded ${
                          isDisabled ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <Checkbox
                          id={`client-${client.subject_id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleClient(client.subject_id)}
                          disabled={isDisabled}
                        />
                        <Label
                          htmlFor={`client-${client.subject_id}`}
                          className={`flex-1 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <div className="font-medium">{client.name}</div>
                          {client.sport && (
                            <div className="text-xs text-muted-foreground">{client.sport}</div>
                          )}
                        </Label>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="text-sm text-muted-foreground">{formData.selectedClients.length} client(s) selected</div>
            </div>

            {/* Generated Link Display */}
            {generatedLink && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <LinkIcon className="size-5" />
                  <h3>Session Link</h3>
                </div>
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <p className="text-sm font-mono break-all">{generatedLink}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 border-t border-border">
              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                disabled={formData.selectedClients.length === 0 || isSubmitting || isLoadingClients}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Session...
                  </>
                ) : (
                  "Schedule Session"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
