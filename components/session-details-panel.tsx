"use client"

import Link from "next/link"
import { Calendar, Clock, Users, LinkIcon, Video, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Session {
  id: string
  title: string
  date: Date
  time: string
  type: "1:1" | "group"
  clients: string[]
  link: string
  status: "scheduled" | "completed" | "cancelled"
}

interface SessionDetailsPanelProps {
  session: Session
  onClose: () => void
}

export default function SessionDetailsPanel({ session, onClose }: SessionDetailsPanelProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const copyLink = () => {
    const fullLink = `${window.location.origin}${session.link}`
    navigator.clipboard.writeText(fullLink)
    alert("Session link copied to clipboard!")
  }

  return (
    <div className="relative transition-all duration-300 ease-in-out w-[40%] border-l border-border bg-muted">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 z-50 h-16 w-10 rounded-full border-2 border-border bg-background shadow-lg hover:bg-background hover:shadow-xl transition-all"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-muted border-b border-border/30 px-6 py-4">
          <h2 className="text-2xl font-bold text-foreground">{session.title}</h2>
          <Badge variant={session.type === "group" ? "default" : "secondary"} className="mt-2">
            {session.type === "group" ? "Group Session" : "1:1 Session"}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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

          {/* Clients */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Users className="size-5" />
              <span>Participants ({session.clients.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {session.clients.map((client, index) => (
                <Badge key={index} variant="outline">
                  {client}
                </Badge>
              ))}
            </div>
          </div>

          {/* Session Link */}
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

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-border">
            <Link href={session.link} className="block">
              <Button className="w-full gap-2" size="lg">
                <Video className="size-5" />
                Join Session
              </Button>
            </Link>
            <Button variant="outline" onClick={onClose} className="w-full bg-transparent" size="lg">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
