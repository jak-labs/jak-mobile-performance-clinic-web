"use client"

import { useParams, useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Calendar, Clock, TrendingUp, Activity, Target, Mail, Plus, Trash2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from "react"

interface Subject {
  id: string
  name: string
  age: number
  sport: string
  status: "active" | "scheduled" | "completed"
  lastSession: string
  avatar?: string
  email?: string
  phone?: string
  joinDate?: string
  totalSessions?: number
  upcomingSessions?: number
}

interface Goal {
  id: string
  text: string
  met: boolean
}

interface Note {
  id: string
  text: string
  timestamp: string
}

const recentSessions = [
  {
    id: "1",
    title: "Strength & Power Training",
    date: "Oct 28, 2024",
    time: "8:00 AM",
    duration: "60 min",
    type: "1:1",
    status: "completed",
  },
  {
    id: "2",
    title: "Speed & Agility",
    date: "Oct 25, 2024",
    time: "10:00 AM",
    duration: "45 min",
    type: "1:1",
    status: "completed",
  },
  {
    id: "3",
    title: "Recovery Session",
    date: "Oct 22, 2024",
    time: "3:00 PM",
    duration: "30 min",
    type: "1:1",
    status: "completed",
  },
]

const upcomingSessions = [
  {
    id: "4",
    title: "Performance Assessment",
    date: "Nov 1, 2024",
    time: "9:00 AM",
    duration: "90 min",
    type: "1:1",
  },
  {
    id: "5",
    title: "Conditioning Workout",
    date: "Nov 4, 2024",
    time: "8:00 AM",
    duration: "60 min",
    type: "1:1",
  },
]

export default function ClientPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Subject | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([
    {
      id: "1",
      text: "Client showed great improvement in sprint technique during today's session.",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "2",
      text: "Discussed nutrition plan and recovery strategies. Client is committed to following the program.",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ])
  const [newNote, setNewNote] = useState("")
  const [goals, setGoals] = useState<Goal[]>([
    { id: "1", text: "Improve sprint time by 0.5 seconds", met: false },
    { id: "2", text: "Complete 10 strength training sessions", met: true },
  ])
  const [newGoal, setNewGoal] = useState("")

  useEffect(() => {
    fetchClient()
  }, [clientId])

  const fetchClient = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/subjects/${clientId}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        if (response.status === 404) {
          setError("Client not found")
        } else if (response.status === 403) {
          setError(errorData.error || "You don't have permission to view this client")
        } else {
          setError(errorData.error || "Failed to fetch client")
        }
        setIsLoading(false)
        return
      }
      const data = await response.json()
      
      // API returns { subject, coach } - extract subject from response
      const subjectData = data.subject || data
      
      // Map the API response to the Subject interface
      const firstName = subjectData.first_name || subjectData.f_name || ""
      const lastName = subjectData.last_name || subjectData.l_name || ""
      const name = subjectData.name || 
                   subjectData.full_name || 
                   (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || "Unknown")
      
      // Calculate age from date_of_birth if available
      let age: number | null = null
      if (subjectData.date_of_birth) {
        const birthDate = new Date(subjectData.date_of_birth)
        const today = new Date()
        age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--
        }
      } else if (subjectData.age) {
        age = parseInt(subjectData.age)
      }
      
      const sport = subjectData.sport || subjectData.sport_type || subjectData.activity || "Not specified"
      const status: "active" | "scheduled" | "completed" = subjectData.status === "pending_invite" 
        ? "active" 
        : (subjectData.status || "active")
      
      const lastSession = subjectData.last_session 
        ? formatLastSession(subjectData.last_session)
        : "No sessions yet"
      
      const mappedClient: Subject = {
        id: subjectData.subject_id || subjectData.id || clientId,
        name,
        age,
        sport,
        status,
        lastSession,
        avatar: subjectData.avatar || subjectData.profile_image,
        email: subjectData.email,
        phone: subjectData.phone,
        joinDate: subjectData.created_at ? formatJoinDate(subjectData.created_at) : undefined,
        totalSessions: subjectData.total_sessions || 0,
        upcomingSessions: subjectData.upcoming_sessions || 0,
      }
      
      setClient(mappedClient)
    } catch (err: any) {
      setError(err.message || "Failed to load client")
      console.error("Error fetching client:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatLastSession = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      
      if (diffMins < 60) {
        return `${diffMins} minutes ago`
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
      } else {
        return date.toLocaleDateString()
      }
    } catch {
      return "Recently"
    }
  }

  const formatJoinDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    } catch {
      return "Recently"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <p className="text-muted-foreground">Loading client...</p>
        </Card>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Client Not Found</h2>
          <p className="text-muted-foreground mb-6">{error || "The client you're looking for doesn't exist."}</p>
          <Button onClick={() => router.push("/clients")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Card>
      </div>
    )
  }

  const getStatusColor = (status: Subject["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-700 border-green-500/30"
      case "scheduled":
        return "bg-blue-500/20 text-blue-700 border-blue-500/30"
      case "completed":
        return "bg-gray-500/20 text-gray-700 border-gray-500/30"
    }
  }

  const addNote = () => {
    if (newNote.trim()) {
      setNotes([{ id: Date.now().toString(), text: newNote, timestamp: new Date().toISOString() }, ...notes])
      setNewNote("")
    }
  }

  const deleteNote = (id: string) => {
    setNotes(notes.filter((note) => note.id !== id))
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
      return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    } else if (diffInDays === 1) {
      return "Yesterday"
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }
  }

  const addGoal = () => {
    if (newGoal.trim()) {
      setGoals([...goals, { id: Date.now().toString(), text: newGoal, met: false }])
      setNewGoal("")
    }
  }

  const toggleGoal = (id: string) => {
    setGoals(goals.map((goal) => (goal.id === id ? { ...goal, met: !goal.met } : goal)))
  }

  const deleteGoal = (id: string) => {
    setGoals(goals.filter((goal) => goal.id !== id))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 pl-20">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <Button variant="ghost" onClick={() => router.push("/clients")} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>

          {/* Client Header */}
          <Card className="p-8 mb-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={client.avatar || "/placeholder.svg"} alt={client.name} />
                <AvatarFallback className="text-2xl font-semibold">
                  {client.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{client.name}</h1>
                    <p className="text-muted-foreground text-lg mb-3">
                      {client.age} years • {client.sport}
                    </p>
                    <Badge variant="outline" className={getStatusColor(client.status)}>
                      {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Joined {client.joinDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last session: {client.lastSession}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-6 mb-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Total Sessions</h3>
              </div>
              <p className="text-3xl font-bold">{client.totalSessions}</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold">Upcoming</h3>
              </div>
              <p className="text-3xl font-bold">{client.upcomingSessions}</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="font-semibold">Progress</h3>
              </div>
              <p className="text-3xl font-bold">+12%</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="font-semibold">Goals Met</h3>
              </div>
              <p className="text-3xl font-bold">8/10</p>
            </Card>
          </div>

          {/* Tabs Content */}
          <Tabs defaultValue="notes" className="space-y-6">
            <TabsList>
              <TabsTrigger value="notes">Notes & Goals</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="space-y-6">
              {/* Notes Section */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Notes</h2>

                <div className="mb-6">
                  <Textarea
                    placeholder="Add a new note about this client..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[100px] resize-none mb-3"
                  />
                  <Button onClick={addNote} disabled={!newNote.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Previous Notes</h3>
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm text-muted-foreground">{formatTimestamp(note.timestamp)}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm leading-relaxed">{note.text}</p>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No notes yet. Add a note to get started!</p>
                  )}
                </div>
              </Card>

              {/* Goals Section */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Goals</h2>

                {/* Add New Goal */}
                <div className="flex gap-2 mb-6">
                  <Input
                    placeholder="Enter a new goal..."
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addGoal()}
                  />
                  <Button onClick={addGoal}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Goal
                  </Button>
                </div>

                {/* Goals List */}
                <div className="space-y-3">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox checked={goal.met} onCheckedChange={() => toggleGoal(goal.id)} id={`goal-${goal.id}`} />
                      <label
                        htmlFor={`goal-${goal.id}`}
                        className={`flex-1 cursor-pointer ${goal.met ? "line-through text-muted-foreground" : ""}`}
                      >
                        {goal.text}
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteGoal(goal.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {goals.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No goals yet. Add a goal to get started!</p>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="space-y-6">
              {/* Upcoming Sessions */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Upcoming Sessions</h2>
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{session.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {session.date} • {session.time} • {session.duration}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-700 border-blue-500/30">
                        {session.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recent Sessions */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Recent Sessions</h2>
                <div className="space-y-3">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <Activity className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{session.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {session.date} • {session.time} • {session.duration}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-gray-500/20 text-gray-700 border-gray-500/30">
                          {session.type}
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30">
                          {session.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Performance Metrics</h2>
                <p className="text-muted-foreground">Performance tracking and analytics coming soon...</p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
