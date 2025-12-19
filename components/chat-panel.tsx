"use client"

import { useState, useEffect, useRef } from "react"
import { useRoomContext } from "@livekit/components-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Bot } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ConnectionState, RoomEvent } from "livekit-client"

interface ChatMessage {
  message_id: string
  participant_id: string
  participant_name: string
  message: string
  message_type: "user" | "ai_agent"
  timestamp: string
  metadata?: {
    metric_type?: "balance" | "symmetry" | "postural" | "general"
    participant_id?: string
    values?: {
      balance_score?: number
      symmetry_score?: number
      postural_efficiency?: number
    }
  }
}

interface ChatPanelProps {
  sessionId?: string | null
  sessionOwnerId?: string | null
  participantInfo: Record<string, { fullName?: string }>
  localParticipantId?: string
}

export function ChatPanel({ sessionId, sessionOwnerId, participantInfo, localParticipantId }: ChatPanelProps) {
  const room = useRoomContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const welcomeMessageSentRef = useRef<Set<string>>(new Set()) // Track which participants have received welcome message

  // Get local participant name
  const localParticipantName = localParticipantId 
    ? (participantInfo[localParticipantId]?.fullName || "You")
    : "You"

  // Send welcome message when participants join
  const sendWelcomeMessage = async (participantId: string, participantName: string) => {
    if (!sessionId || !room) {
      console.log('[Chat] ⚠️ Cannot send welcome message - sessionId or room missing')
      return
    }

    const welcomeMessage = `👋 Welcome to the session, ${participantName}! I'm your AI Coach. I'll be monitoring your movement and providing real-time feedback throughout the session. Let's get started!`

    console.log(`[Chat] 💬 Sending welcome message to ${participantName}`)

    try {
      // Save to database
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          participantId: 'ai_agent',
          participantName: 'AI Coach',
          message: welcomeMessage,
          messageType: 'ai_agent',
          metadata: {
            message_type: 'welcome',
            participant_id: participantId,
          },
        }),
      })

      if (response.ok) {
        console.log(`[Chat] ✅ Successfully saved welcome message for ${participantName}`)
        
        // Also send via LiveKit data channel for real-time delivery
        if (room.state === ConnectionState.Connected && room.localParticipant) {
          const chatMessage = {
            message_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            participant_id: 'ai_agent',
            participant_name: 'AI Coach',
            message: welcomeMessage,
            message_type: 'ai_agent' as const,
            timestamp: new Date().toISOString(),
            metadata: {
              message_type: 'welcome',
              participant_id: participantId,
            },
          }

          const data = JSON.stringify({
            type: 'chat_message',
            message: chatMessage,
          })

          room.localParticipant.publishData(
            new TextEncoder().encode(data),
            { reliable: true }
          )
          console.log(`[Chat] ✅ Published welcome message via LiveKit data channel for ${participantName}`)
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('[Chat] ❌ Failed to send welcome message:', response.status, errorText)
      }
    } catch (error) {
      console.error('[Chat] ❌ Error sending welcome message:', error)
    }
  }

  // Send welcome message when participants join (immediately)
  useEffect(() => {
    if (!sessionId || !room || room.state !== ConnectionState.Connected) {
      console.log('[Chat] 👋 Welcome message effect skipped - missing requirements:', {
        hasSessionId: !!sessionId,
        hasRoom: !!room,
        roomState: room?.state
      })
      return
    }

    // Listen for participant connected events
    const handleParticipantConnected = (participant: any) => {
      if (!participant || !participant.identity) return

      const participantId = participant.identity
      
      // Skip coach for non-mocap sessions (if sessionOwnerId is provided)
      if (sessionOwnerId && participantId === sessionOwnerId) {
        console.log(`[Chat] 👋 Skipping welcome for coach: ${participantId}`)
        return
      }

      // Skip if already sent welcome message
      if (welcomeMessageSentRef.current.has(participantId)) {
        console.log(`[Chat] 👋 Already sent welcome to: ${participantId}`)
        return
      }

      // Mark as sent immediately to prevent duplicates
      welcomeMessageSentRef.current.add(participantId)

      // Get participant name
      const participantName = participantInfo[participantId]?.fullName || participant.name || participantId
      
      console.log(`[Chat] 👋 Participant connected: ${participantName} (${participantId}) - sending welcome message immediately`)
      
      // Send welcome message immediately
      sendWelcomeMessage(participantId, participantName)
    }

    // Check existing participants when effect runs
    const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())].filter(Boolean)
    allParticipants.forEach(participant => {
      if (!participant) return
      const participantId = participant.identity
      
      // Skip coach for non-mocap sessions
      if (sessionOwnerId && participantId === sessionOwnerId) {
        return
      }

      // Skip if already sent welcome message
      if (welcomeMessageSentRef.current.has(participantId)) {
        return
      }

      // Mark as sent immediately to prevent duplicates
      welcomeMessageSentRef.current.add(participantId)

      // Get participant name
      const participantName = participantInfo[participantId]?.fullName || participant.name || participantId
      
      console.log(`[Chat] 👋 Existing participant found: ${participantName} (${participantId}) - sending welcome message immediately`)
      
      // Send welcome message immediately
      sendWelcomeMessage(participantId, participantName)
    })

    // Listen for new participants joining
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected)

    // Cleanup
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected)
    }
  }, [sessionId, room, room?.state, participantInfo, sessionOwnerId])

  // Fetch messages on mount and when sessionId changes
  useEffect(() => {
    if (!sessionId) return

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/chat/messages/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages || [])
        }
      } catch (error) {
        console.error('[Chat] Error fetching messages:', error)
      }
    }

    fetchMessages()
    // Poll for new messages every 2 seconds
    const interval = setInterval(fetchMessages, 2000)
    return () => clearInterval(interval)
  }, [sessionId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Listen for LiveKit data channel messages (for real-time updates)
  useEffect(() => {
    if (!room) return

    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const text = new TextDecoder().decode(payload)
        const data = JSON.parse(text)
        
        if (data.type === 'chat_message' && data.message) {
          setMessages(prev => [...prev, data.message])
        }
      } catch (error) {
        console.error('[Chat] Error parsing data channel message:', error)
      }
    }

    room.on('dataReceived', handleDataReceived)
    return () => {
      room.off('dataReceived', handleDataReceived)
    }
  }, [room])

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId || !localParticipantId || isSending) return

    setIsSending(true)
    const messageText = inputMessage.trim()

    try {
      // Save to database
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          participantId: localParticipantId,
          participantName: localParticipantName,
          message: messageText,
          messageType: 'user',
        }),
      })

      if (response.ok) {
        // Also send via LiveKit data channel for real-time delivery
        if (room) {
          const message: ChatMessage = {
            message_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            participant_id: localParticipantId,
            participant_name: localParticipantName,
            message: messageText,
            message_type: 'user',
            timestamp: new Date().toISOString(),
          }

          const data = JSON.stringify({
            type: 'chat_message',
            message,
          })

          room.localParticipant?.publishData(
            new TextEncoder().encode(data),
            { reliable: true }
          )
        }

        setInputMessage("")
        // Refresh messages to get the saved one from DB
        setTimeout(() => {
          fetch(`/api/chat/messages/${sessionId}`)
            .then(res => res.json())
            .then(data => setMessages(data.messages || []))
            .catch(console.error)
        }, 100)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }))
        console.error('[Chat] Error sending message:', errorData)
        alert(errorData.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('[Chat] Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Chat</h3>
      </div>

      <div className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.message_id}
                className={`flex ${msg.participant_id === localParticipantId ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`p-3 max-w-[80%] ${
                  msg.message_type === 'ai_agent' 
                    ? 'bg-primary/10 border-primary/20' 
                    : msg.participant_id === localParticipantId
                    ? 'bg-primary/5'
                    : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.message_type === 'ai_agent' && (
                      <Bot className="h-3 w-3 text-primary" />
                    )}
                    <span className="text-xs font-semibold">
                      {msg.participant_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  {msg.metadata?.values && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {msg.metadata.values.balance_score !== undefined && (
                        <span>Balance: {msg.metadata.values.balance_score} </span>
                      )}
                      {msg.metadata.values.symmetry_score !== undefined && (
                        <span>Symmetry: {msg.metadata.values.symmetry_score} </span>
                      )}
                      {msg.metadata.values.postural_efficiency !== undefined && (
                        <span>Postural: {msg.metadata.values.postural_efficiency}</span>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="min-h-[60px] resize-none"
            disabled={isSending || !sessionId}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isSending || !sessionId}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

