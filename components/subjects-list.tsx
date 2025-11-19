"use client"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import { useState, useEffect } from "react"
import AddClientPanel from "@/components/add-client-panel"

interface Subject {
  id: string
  name: string
  age: number | null
  sport: string
  status: "active" | "scheduled" | "completed" | "pending"
  lastSession: string
  avatar?: string
}

export default function SubjectsList() {
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [unassignedSubjects, setUnassignedSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/subjects")
      if (!response.ok) {
        throw new Error("Failed to fetch clients")
      }
      const data = await response.json()
      
      // Map assigned subjects to the expected format
      const mappedSubjects: Subject[] = (data.subjects || []).map((subject: any) => {
        // Get name from various possible fields
        const firstName = subject.first_name || subject.f_name || ""
        const lastName = subject.last_name || subject.l_name || ""
        const name = subject.name || 
                     subject.full_name || 
                     (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || "Unknown")
        
        // Get sport
        const sport = subject.sport || subject.sport_type || subject.activity || "Not specified"
        
        // Calculate age from date_of_birth if available, otherwise use age field or null
        let age: number | null = null
        if (subject.date_of_birth) {
          const birthDate = new Date(subject.date_of_birth)
          const today = new Date()
          age = today.getFullYear() - birthDate.getFullYear()
          const monthDiff = today.getMonth() - birthDate.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--
          }
        } else if (subject.age) {
          age = parseInt(subject.age)
        }
        
        // Determine status - include pending invites
        const status: "active" | "scheduled" | "completed" | "pending" = subject.status === "pending_invite" 
          ? "pending" 
          : (subject.status === "active" || subject.status === "scheduled" || subject.status === "completed" 
              ? subject.status 
              : "active")
        
        // Format last session - pending invites don't have sessions yet
        const lastSession = subject.status === "pending_invite" 
          ? "Pending invite" 
          : (subject.last_session 
              ? formatLastSession(subject.last_session)
              : "No sessions yet")
        
        return {
          id: subject.subject_id || subject.id,
          name,
          age,
          sport,
          status,
          lastSession,
          avatar: subject.avatar || subject.profile_image,
        }
      })
      
      // Map unassigned subjects to the expected format
      const mappedUnassigned: Subject[] = (data.unassignedSubjects || []).map((subject: any) => {
        const firstName = subject.first_name || subject.f_name || ""
        const lastName = subject.last_name || subject.l_name || ""
        const name = subject.name || 
                     subject.full_name || 
                     (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || "Unknown")
        
        const sport = subject.sport || subject.sport_type || subject.activity || "Not specified"
        
        let age: number | null = null
        if (subject.date_of_birth) {
          const birthDate = new Date(subject.date_of_birth)
          const today = new Date()
          age = today.getFullYear() - birthDate.getFullYear()
          const monthDiff = today.getMonth() - birthDate.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--
          }
        } else if (subject.age) {
          age = parseInt(subject.age)
        }
        
        const status: "active" | "scheduled" | "completed" | "pending" = subject.status === "pending_invite" 
          ? "pending" 
          : (subject.status === "active" || subject.status === "scheduled" || subject.status === "completed" 
              ? subject.status 
              : "active")
        
        const lastSession = subject.last_session 
          ? formatLastSession(subject.last_session)
          : "No sessions yet"
        
        return {
          id: subject.subject_id || subject.id,
          name,
          age,
          sport,
          status,
          lastSession,
          avatar: subject.avatar || subject.profile_image,
        }
      })
      
      setSubjects(mappedSubjects)
      setUnassignedSubjects(mappedUnassigned)
    } catch (err: any) {
      setError(err.message || "Failed to load clients")
      console.error("Error fetching subjects:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssignClient = async (subjectId: string) => {
    setAssigningId(subjectId)
    try {
      const response = await fetch("/api/subjects/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subjectId }),
      })

      if (!response.ok) {
        throw new Error("Failed to assign client")
      }

      // Refresh the list
      await fetchSubjects()
    } catch (err: any) {
      console.error("Error assigning client:", err)
      alert(err.message || "Failed to assign client")
    } finally {
      setAssigningId(null)
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

  const getStatusColor = (status: Subject["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-700 border-green-500/30"
      case "scheduled":
        return "bg-blue-500/20 text-blue-700 border-blue-500/30"
      case "completed":
        return "bg-gray-500/20 text-gray-700 border-gray-500/30"
      case "pending":
        return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30"
    }
  }

  const filteredSubjects = subjects.filter((subject) => {
    const query = searchQuery.toLowerCase()
    return (
      subject.name.toLowerCase().includes(query) ||
      subject.sport.toLowerCase().includes(query) ||
      subject.status.toLowerCase().includes(query)
    )
  })

  const filteredUnassigned = unassignedSubjects.filter((subject) => {
    const query = searchQuery.toLowerCase()
    return (
      subject.name.toLowerCase().includes(query) ||
      subject.sport.toLowerCase().includes(query) ||
      subject.status.toLowerCase().includes(query)
    )
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={`flex-1 transition-all duration-300 ${isAddClientOpen ? "w-[60%]" : "w-full"} flex flex-col`}>
        <div className="flex-1 overflow-y-auto bg-background p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 pt-16 md:pt-8">
              <div className="flex items-center justify-between mb-4 pl-12">
                <div>
                  <h1 className="text-xl md:text-3xl font-bold text-foreground mb-2">Clients</h1>
                  <p className="text-muted-foreground">Manage and monitor your athletes</p>
                </div>
                <Button onClick={() => setIsAddClientOpen(true)} size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Add Client
                </Button>
              </div>

              <div className="relative max-w-md pl-12">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search clients by name, sport, or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading clients...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive">{error}</p>
                <Button onClick={fetchSubjects} className="mt-4">Retry</Button>
              </div>
            ) : (
              <>
                {/* My Clients Section */}
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-foreground mb-4">My Clients</h2>
                  {filteredSubjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredSubjects.map((subject) => (
                        <Link 
                          key={subject.id} 
                          href={subject.status === "pending" ? "#" : `/clients/${subject.id}`}
                          onClick={(e) => {
                            if (subject.status === "pending") {
                              e.preventDefault()
                            }
                          }}
                        >
                          <Card className={`p-6 transition-all duration-200 border-border/50 bg-card ${
                            subject.status === "pending" 
                              ? "opacity-75 cursor-not-allowed" 
                              : "hover:shadow-lg hover:scale-[1.02] cursor-pointer"
                          }`}>
                            <div className="flex items-start gap-4">
                              <Avatar className="h-16 w-16">
                                <AvatarImage src={subject.avatar || "/placeholder.svg"} alt={subject.name} />
                                <AvatarFallback className="text-lg font-semibold">
                                  {subject.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-semibold text-foreground mb-1 truncate">{subject.name}</h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {subject.age ? `${subject.age} years • ` : ""}{subject.sport}
                                </p>
                                <Badge variant="outline" className={`text-xs ${getStatusColor(subject.status)}`}>
                                  {subject.status.charAt(0).toUpperCase() + subject.status.slice(1)}
                                </Badge>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/30">
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">Last Session:</span> {subject.lastSession}
                              </p>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-border/30 rounded-lg">
                      <p className="text-muted-foreground">
                        {searchQuery ? `No clients found matching "${searchQuery}"` : "No clients assigned yet. Add your first client to get started."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Un-Assigned Clients Section */}
                {filteredUnassigned.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-foreground mb-4">Un-Assigned Clients</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredUnassigned.map((subject) => (
                        <Card key={subject.id} className="p-6 border-border/50 bg-card">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-16 w-16">
                              <AvatarImage src={subject.avatar || "/placeholder.svg"} alt={subject.name} />
                              <AvatarFallback className="text-lg font-semibold">
                                {subject.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-semibold text-foreground mb-1 truncate">{subject.name}</h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                {subject.age ? `${subject.age} years • ` : ""}{subject.sport}
                              </p>
                              <Badge variant="outline" className={`text-xs ${getStatusColor(subject.status)}`}>
                                {subject.status.charAt(0).toUpperCase() + subject.status.slice(1)}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-border/30">
                            <p className="text-sm text-muted-foreground mb-3">
                              <span className="font-medium">Last Session:</span> {subject.lastSession}
                            </p>
                            <Button
                              onClick={() => handleAssignClient(subject.id)}
                              disabled={assigningId === subject.id}
                              className="w-full"
                            >
                              {assigningId === subject.id ? "Adding..." : "Add to Client List"}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AddClientPanel 
        isOpen={isAddClientOpen} 
        onClose={() => setIsAddClientOpen(false)}
        onClientAdded={() => {
          setIsAddClientOpen(false)
          fetchSubjects() // Refresh the list after adding a client
        }}
      />
    </div>
  )
}
