"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Bot, User } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ChatMessage {
  message_id: string
  participant_id: string
  participant_name: string
  message: string
  message_type: "user" | "ai_agent"
  timestamp: string
  metadata?: {
    metric_type?: string
    values?: Record<string, number>
  }
}

interface BaseballChatPanelProps {
  sessionId?: string | null
  sessionOwnerId?: string | null
  participantInfo: Record<string, { fullName?: string }>
  localParticipantId?: string
}

// Baseball-specific AI coach messages
const BASEBALL_AI_MESSAGES = [
  // Kinematic Sequence Messages
  {
    message: "🎯 Excellent kinematic sequence! Your pelvis is leading the rotation perfectly, creating a smooth energy transfer from lower to upper body. This is generating maximum power efficiency.",
    type: "kinematic_positive"
  },
  {
    message: "⚡ I'm seeing great arm velocity (6,800 deg/s), but let's work on delaying arm acceleration by 20-30ms. Allow your hips to fully rotate first - this will add 2-3 mph to your velocity.",
    type: "kinematic_timing"
  },
  {
    message: "🔄 Notice how your pelvis and torso are rotating together? Let's separate those movements. Think 'hips first, then torso whips through.' This sequencing will unlock more power.",
    type: "kinematic_improvement"
  },
  
  // Hip-Shoulder Separation
  {
    message: "💪 Outstanding hip-shoulder separation at 52°! This elastic stretch is storing tremendous energy. Keep this pattern - it's a key factor in your velocity.",
    type: "separation_excellent"
  },
  {
    message: "📊 Your hip-shoulder separation is at 38° - that's good, but increasing to 45-50° could add significant velocity. Focus on aggressive hip rotation while keeping shoulders closed longer.",
    type: "separation_improvement"
  },
  {
    message: "⚠️ Hip-shoulder separation is limited (32°). This is reducing your power output. Let's work on hip mobility drills and delay your upper body rotation.",
    type: "separation_critical"
  },
  
  // Ground Force & Timing
  {
    message: "⏱️ Perfect ground force timing! Your foot plant is syncing beautifully with pelvis rotation (185ms). This timing is key for transferring energy from the ground up.",
    type: "timing_excellent"
  },
  {
    message: "🦵 I'm seeing a slight delay in ground force application. Work on explosive hip drive at foot plant. Think 'land and explode' rather than 'land and drift.'",
    type: "timing_improvement"
  },
  {
    message: "⚡ Your stride timing is spot-on at 155ms. This optimal stride-to-plant window is setting you up for maximum power generation.",
    type: "stride_timing"
  },
  
  // Symmetry & Balance
  {
    message: "⚖️ Excellent bilateral leg drive! Both legs are contributing equally (93/100 symmetry score). This balanced force production protects your arm and maximizes efficiency.",
    type: "symmetry_excellent"
  },
  {
    message: "🎯 Minor leg drive imbalance detected. Your front leg could contribute more during deceleration. Add single-leg exercises to build that front leg stability.",
    type: "symmetry_improvement"
  },
  
  // Rotation Analysis
  {
    message: "🌪️ Torso rotation velocity is excellent (1,050 deg/s)! Your trunk is generating serious rotational power. This is translating directly into arm velocity.",
    type: "rotation_positive"
  },
  {
    message: "📈 Pelvis rotation at 53° - great range! Your pelvis is clearing efficiently, creating space for torso rotation. This is a strength in your mechanics.",
    type: "pelvis_positive"
  },
  
  // Overall Performance
  {
    message: "🏆 Overall kinematic efficiency at 88/100! You're moving like a high-level athlete. Your sequencing, separation, and timing are all in optimal ranges.",
    type: "overall_excellent"
  },
  {
    message: "💡 Quick coaching point: I'm seeing slight arm compensation for lower body power. Focus drills on hip drive and you'll see immediate velocity gains.",
    type: "coaching_tip"
  },
  {
    message: "🔥 Great session! Your movement quality is improving. Key focus for next time: delay arm acceleration to allow full hip rotation.",
    type: "session_summary"
  },
  
  // Risk Assessment
  {
    message: "✅ Injury risk assessment: LOW. Your mechanics show good sequencing and no compensatory patterns. Keep up the strength training and recovery protocols.",
    type: "risk_low"
  },
  {
    message: "⚠️ Moderate injury risk detected. You're over-relying on arm velocity to compensate for lower body power. Let's reduce throwing volume 20% and focus on sequencing mechanics.",
    type: "risk_moderate"
  },
  {
    message: "🚨 Elevated injury risk: Your arm is compensating heavily for poor sequencing. Recommend reducing intensity to 50% and working with coach on hip-loading drills immediately.",
    type: "risk_high"
  },
  
  // Motivation & Encouragement
  {
    message: "💪 Strong work! Every rep with proper mechanics is building better movement patterns. Stay focused on the process.",
    type: "motivation"
  },
  {
    message: "🎯 You're doing great! Small adjustments in sequencing can lead to big gains. Trust the process and stay patient with the mechanics work.",
    type: "encouragement"
  }
]

// Generate a random AI message based on dummy metrics
function generateAIMessage(messageCounter: number): ChatMessage {
  const randomMessage = BASEBALL_AI_MESSAGES[Math.floor(Math.random() * BASEBALL_AI_MESSAGES.length)]
  
  return {
    message_id: `ai-${Date.now()}-${messageCounter}`,
    participant_id: 'ai_agent',
    participant_name: 'AI Baseball Coach',
    message: randomMessage.message,
    message_type: 'ai_agent',
    timestamp: new Date().toISOString(),
    metadata: {
      metric_type: randomMessage.type,
      values: {
        kinematicScore: 75 + Math.random() * 20,
        hipShoulderSeparation: 35 + Math.random() * 20,
        performanceScore: 70 + Math.random() * 25
      }
    }
  }
}

export function BaseballChatPanel({ sessionId, sessionOwnerId, participantInfo, localParticipantId }: BaseballChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageCounter = useRef(0)

  // Get local participant name
  const localParticipantName = localParticipantId 
    ? (participantInfo[localParticipantId]?.fullName || "You")
    : "You"

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Send welcome message on mount
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      message_id: `ai-welcome-${Date.now()}`,
      participant_id: 'ai_agent',
      participant_name: 'AI Baseball Coach',
      message: `👋 Welcome! I'm your AI Baseball Coach. I'll be analyzing your pitching mechanics in real-time, focusing on kinematic sequencing, hip-shoulder separation, timing, and injury risk. Let's maximize your performance while keeping you healthy! 🎯⚾`,
      message_type: 'ai_agent',
      timestamp: new Date().toISOString(),
      metadata: { metric_type: 'welcome' }
    }

    setMessages([welcomeMessage])
  }, [])

  // Send AI messages every 20-40 seconds (randomized for realism)
  useEffect(() => {
    const sendRandomAIMessage = () => {
      messageCounter.current += 1
      const aiMessage = generateAIMessage(messageCounter.current)
      setMessages(prev => [...prev, aiMessage])
      console.log('[Baseball Chat] 🤖 AI Coach sent message:', aiMessage.message.substring(0, 50) + '...')
    }

    // First message after 10 seconds
    const firstTimeout = setTimeout(sendRandomAIMessage, 10000)

    // Then random messages every 20-40 seconds
    const interval = setInterval(() => {
      const randomDelay = 20000 + Math.random() * 20000 // 20-40 seconds
      setTimeout(sendRandomAIMessage, randomDelay)
    }, 35000) // Check every 35 seconds on average

    return () => {
      clearTimeout(firstTimeout)
      clearInterval(interval)
    }
  }, [])

  // Handle user message send
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const userMessage: ChatMessage = {
      message_id: `user-${Date.now()}`,
      participant_id: localParticipantId || 'unknown',
      participant_name: localParticipantName,
      message: inputMessage,
      message_type: 'user',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage("")

    // Send AI response after 2-4 seconds
    setTimeout(() => {
      messageCounter.current += 1
      const aiResponse = generateAIMessage(messageCounter.current)
      setMessages(prev => [...prev, aiResponse])
    }, 2000 + Math.random() * 2000)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 p-3 bg-black/40">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Baseball AI Coach Chat</h3>
          <div className="ml-auto text-xs text-green-400 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Live Analysis
          </div>
        </div>
        <p className="text-xs text-white/40 mt-1">Real-time coaching feedback on your mechanics</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.message_id}
            className={`flex gap-3 ${msg.message_type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.message_type === 'ai_agent' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-white/10 text-white/60'
            }`}>
              {msg.message_type === 'ai_agent' ? (
                <Bot className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[80%] ${msg.message_type === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="text-xs text-white/40 mb-1">
                {msg.participant_name} • {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
              <Card className={`p-3 ${
                msg.message_type === 'ai_agent'
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : 'bg-white/5 border-white/10'
              }`}>
                <p className="text-sm text-white/90 whitespace-pre-wrap">{msg.message}</p>
                {msg.metadata?.metric_type && msg.message_type === 'ai_agent' && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="text-xs text-white/40">
                      Analysis type: {msg.metadata.metric_type.replace('_', ' ')}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3 bg-black/40">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Ask the AI coach about your mechanics..."
            className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className="self-end px-4 bg-blue-500 hover:bg-blue-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-white/30 mt-2">
          💡 AI Coach analyzes your metrics and provides feedback automatically
        </div>
      </div>
    </div>
  )
}
