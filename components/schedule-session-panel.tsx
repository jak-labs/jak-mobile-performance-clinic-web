"use client"

import type React from "react"
import { useState } from "react"
import { ChevronRight, Calendar, Users, LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"

interface ScheduleSessionPanelProps {
  isOpen: boolean
  onClose: () => void
  onAddSession: (session: {
    title: string
    date: Date
    time: string
    type: "1:1" | "group"
    clients: string[]
  }) => void
}

// Mock client data
const mockClients = [
  { id: "1", name: "Sarah Johnson", sport: "Track & Field" },
  { id: "2", name: "Marcus Williams", sport: "Basketball" },
  { id: "3", name: "Emily Chen", sport: "Swimming" },
  { id: "4", name: "David Martinez", sport: "Soccer" },
  { id: "5", name: "Alex Thompson", sport: "Tennis" },
  { id: "6", name: "Jessica Rodriguez", sport: "Volleyball" },
  { id: "7", name: "Ryan O'Connor", sport: "Baseball" },
  { id: "8", name: "Mia Patel", sport: "Gymnastics" },
  { id: "9", name: "Jordan Lee", sport: "CrossFit" },
]

export default function ScheduleSessionPanel({ isOpen, onClose, onAddSession }: ScheduleSessionPanelProps) {
  const [formData, setFormData] = useState({
    title: "",
    sessionType: "1:1",
    date: "",
    time: "",
    duration: "60",
    notes: "",
    selectedClients: [] as string[],
  })

  const [generatedLink, setGeneratedLink] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const clientNames = mockClients
      .filter((client) => formData.selectedClients.includes(client.id))
      .map((client) => client.name)

    // Parse date and time to create a Date object
    const [year, month, day] = formData.date.split("-").map(Number)
    const [hours, minutes] = formData.time.split(":").map(Number)
    const sessionDate = new Date(year, month - 1, day, hours, minutes)

    onAddSession({
      title: formData.title,
      date: sessionDate,
      time: formData.time,
      type: formData.sessionType as "1:1" | "group",
      clients: clientNames,
    })

    // Reset form
    setFormData({
      title: "",
      sessionType: "1:1",
      date: "",
      time: "",
      duration: "60",
      notes: "",
      selectedClients: [],
    })
    setGeneratedLink("")
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleClient = (clientId: string) => {
    if (formData.sessionType === "1:1") {
      // For 1:1 sessions, replace the selection with the new client
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

  return (
    <div
      className={`relative transition-all duration-300 ease-in-out ${
        isOpen ? "w-[40%]" : "w-0"
      } border-l border-border bg-muted`}
    >
      {isOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 z-50 h-16 w-10 rounded-full border-2 border-border bg-background shadow-lg hover:bg-background hover:shadow-xl transition-all"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}

      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-muted border-b border-border/30 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Schedule Session</h2>
            <p className="text-sm text-muted-foreground mt-1">Create a new coaching session</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
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
                  <div className="flex items-center space-x-3 border border-border rounded-lg p-3">
                    <RadioGroupItem value="1:1" id="one-on-one" />
                    <Label htmlFor="one-on-one" className="flex-1 cursor-pointer">
                      1:1 Session
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 border border-border rounded-lg p-3">
                    <RadioGroupItem value="group" id="group" />
                    <Label htmlFor="group" className="flex-1 cursor-pointer">
                      Group Session
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
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange("time", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="60"
                  value={formData.duration}
                  onChange={(e) => handleInputChange("duration", e.target.value)}
                  required
                />
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
                {formData.sessionType === "1:1"
                  ? "Select one client for this 1:1 session"
                  : "Select multiple clients for this group session"}
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-lg p-3">
                {mockClients.map((client) => {
                  const isSelected = formData.selectedClients.includes(client.id)
                  const isDisabled =
                    formData.sessionType === "1:1" && formData.selectedClients.length > 0 && !isSelected

                  return (
                    <div
                      key={client.id}
                      className={`flex items-center space-x-3 p-2 hover:bg-accent/50 rounded ${
                        isDisabled ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <Checkbox
                        id={`client-${client.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleClient(client.id)}
                        disabled={isDisabled}
                      />
                      <Label
                        htmlFor={`client-${client.id}`}
                        className={`flex-1 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="font-medium">{client.name}</div>
                        <div className="text-xs text-muted-foreground">{client.sport}</div>
                      </Label>
                    </div>
                  )
                })}
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
              <Button type="submit" className="w-full" size="lg" disabled={formData.selectedClients.length === 0}>
                Schedule Session
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
