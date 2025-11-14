"use client"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import { useState } from "react"
import AddClientPanel from "@/components/add-client-panel"

interface Subject {
  id: string
  name: string
  age: number
  sport: string
  status: "active" | "scheduled" | "completed"
  lastSession: string
  avatar?: string
}

const subjects: Subject[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    age: 24,
    sport: "Track & Field",
    status: "active",
    lastSession: "2 hours ago",
    avatar: "/female-athlete.png",
  },
  {
    id: "2",
    name: "Marcus Williams",
    age: 28,
    sport: "Basketball",
    status: "scheduled",
    lastSession: "Tomorrow, 10:00 AM",
    avatar: "/male-basketball-player.jpg",
  },
  {
    id: "3",
    name: "Emily Chen",
    age: 22,
    sport: "Swimming",
    status: "completed",
    lastSession: "Yesterday, 3:00 PM",
    avatar: "/female-swimmer.jpg",
  },
  {
    id: "4",
    name: "David Martinez",
    age: 26,
    sport: "Soccer",
    status: "scheduled",
    lastSession: "Today, 4:00 PM",
    avatar: "/male-soccer-player.jpg",
  },
  {
    id: "5",
    name: "Alex Thompson",
    age: 25,
    sport: "Tennis",
    status: "active",
    lastSession: "1 hour ago",
  },
  {
    id: "6",
    name: "Jessica Rodriguez",
    age: 27,
    sport: "Volleyball",
    status: "completed",
    lastSession: "2 days ago",
  },
  {
    id: "7",
    name: "Ryan O'Connor",
    age: 23,
    sport: "Baseball",
    status: "scheduled",
    lastSession: "Friday, 2:00 PM",
  },
  {
    id: "8",
    name: "Mia Patel",
    age: 21,
    sport: "Gymnastics",
    status: "active",
    lastSession: "30 minutes ago",
  },
  {
    id: "9",
    name: "Jordan Lee",
    age: 29,
    sport: "CrossFit",
    status: "scheduled",
    lastSession: "Monday, 9:00 AM",
  },
]

export default function SubjectsList() {
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

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

  const filteredSubjects = subjects.filter((subject) => {
    const query = searchQuery.toLowerCase()
    return (
      subject.name.toLowerCase().includes(query) ||
      subject.sport.toLowerCase().includes(query) ||
      subject.status.toLowerCase().includes(query)
    )
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={`flex-1 transition-all duration-300 ${isAddClientOpen ? "w-[60%]" : "w-full"}`}>
        <div className="min-h-screen bg-background p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 pl-12">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">Clients</h1>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjects.map((subject) => (
                <Link key={subject.id} href={`/clients/${subject.id}`}>
                  <Card className="p-6 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-border/50 bg-card">
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
                          {subject.age} years • {subject.sport}
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

            {filteredSubjects.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No clients found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddClientPanel isOpen={isAddClientOpen} onClose={() => setIsAddClientOpen(false)} />
    </div>
  )
}
