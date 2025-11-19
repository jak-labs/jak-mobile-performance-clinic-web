"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, ChevronLeft, ChevronRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import Image from "next/image"
import MetricsDashboard from "./metrics-dashboard"
import { useV2 } from "@/lib/v2-context"

interface GroupVideoSessionProps {
  participants: string[]
}

export default function GroupVideoSession({ participants }: GroupVideoSessionProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [participantNotes, setParticipantNotes] = useState<{ [key: string]: string }>({})
  const { v2Enabled } = useV2()

  const allParticipants = [
    { id: "coach", name: "Pierre Devaris (You)", image: "/coach-jak.jpg", isLocal: true },
    { id: "1", name: participants[0] || "Marcus Johnson", image: "/athlete-1.png", isLocal: false },
    { id: "2", name: participants[1] || "Sarah Chen", image: "/athlete-2.png", isLocal: false },
    { id: "3", name: participants[2] || "David Martinez", image: "/athlete-3.png", isLocal: false },
  ]

  const handleAddNote = (participantId: string) => {
    const note = participantNotes[participantId]
    if (note?.trim()) {
      console.log(`[v0] Adding note for participant ${participantId}:`, note)
      setParticipantNotes({ ...participantNotes, [participantId]: "" })
    }
  }

  return (
    <div className="relative w-full h-full bg-secondary overflow-hidden flex">
      <div
        className={`relative h-full flex flex-col transition-all duration-300 ease-in-out ${
          isPanelOpen ? "w-[60%]" : "w-full"
        }`}
      >
        {/* Group sessions always use 2x2 grid */}
        <div className="flex-1 p-4 grid grid-cols-2 gap-4">
          {allParticipants.map((participant) => (
            <div
              key={participant.id}
              className={`relative bg-black rounded-lg overflow-hidden ${
                participant.isLocal ? "border-2 border-primary" : "border border-border"
              }`}
            >
              <Image
                src={participant.image || "/placeholder.svg"}
                alt={participant.name}
                fill
                className="object-contain"
              />

              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded">
                <p className="text-sm font-medium text-white">{participant.name}</p>
              </div>

              {participant.isLocal && isMuted && (
                <div className="absolute top-2 right-2 bg-destructive p-2 rounded-full">
                  <MicOff className="h-4 w-4 text-destructive-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div 
          className="absolute bottom-8 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-background/95 backdrop-blur-sm px-6 py-3 rounded-full border shadow-lg"
          style={{ 
            bottom: 'max(2rem, calc(2rem + env(safe-area-inset-bottom, 0)))',
            marginBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))'
          }}
        >
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            variant={!isVideoOn ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={() => setIsVideoOn(!isVideoOn)}
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button variant="destructive" size="icon" className="rounded-full h-12 w-12">
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>

        {/* Session Info */}
        <div className="absolute top-4 left-20 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg border">
          <p className="text-xs text-muted-foreground">Session Duration</p>
          <p className="text-sm font-mono font-semibold">00:24:18</p>
        </div>

        <div className="absolute top-4 right-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg border">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium">4 Participants</span>
        </div>
      </div>

      <Button
        variant="secondary"
        size="icon"
        className={`absolute top-1/2 -translate-y-1/2 h-16 w-12 rounded-2xl shadow-lg z-20 transition-all duration-300 ${
          isPanelOpen ? "right-[40%]" : "right-4"
        }`}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        {isPanelOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>

      <div
        className={`h-full border-l bg-background flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isPanelOpen ? "w-[40%] min-w-[500px] max-w-[700px]" : "w-0 min-w-0 border-0"
        }`}
      >
        <Tabs defaultValue="session" className="flex-1 flex flex-col h-full">
          <div className="border-b">
            <TabsList className="w-full rounded-none border-0">
              {v2Enabled && (
                <TabsTrigger value="metrics" className="flex-1">
                  Live Metrics
                </TabsTrigger>
              )}
              <TabsTrigger value="session" className="flex-1">
                Session
              </TabsTrigger>
            </TabsList>
          </div>

          {v2Enabled && (
            <TabsContent
              value="metrics"
              className="flex-1 overflow-y-auto scrollbar-hide mt-0 p-0 h-[calc(100vh-120px)]"
            >
              <MetricsDashboard />
            </TabsContent>
          )}

          <TabsContent
            value="session"
            className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide mt-0 h-[calc(100vh-120px)]"
          >
            <h3 className="font-semibold text-sm">Participants ({allParticipants.length - 1})</h3>
            {allParticipants
              .filter((p) => !p.isLocal)
              .map((participant) => (
                <Card key={participant.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={participant.image || "/placeholder.svg"}
                      alt={participant.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="font-medium text-sm">{participant.name}</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Add Note</label>
                    <Textarea
                      placeholder="Type session notes..."
                      value={participantNotes[participant.id] || ""}
                      onChange={(e) =>
                        setParticipantNotes({
                          ...participantNotes,
                          [participant.id]: e.target.value,
                        })
                      }
                      className="min-h-[60px] text-sm"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleAddNote(participant.id)}
                      disabled={!participantNotes[participant.id]?.trim()}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Save Note
                    </Button>
                  </div>
                </Card>
              ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
