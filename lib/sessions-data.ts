export interface Session {
  id: string
  title: string
  date: Date
  time: string
  type: "1:1" | "group" | "mocap"
  clients: string[]
  link: string
  status: "scheduled" | "completed" | "cancelled"
}

// Mock session data - shared across the app
export const mockSessions: Session[] = [
  // October 2025 - Week 1
  {
    id: "1",
    title: "Morning Strength Training",
    date: new Date(2025, 9, 1, 8, 0),
    time: "8:00 AM",
    type: "1:1",
    clients: ["Sarah Johnson"],
    link: "/session/1",
    status: "completed",
  },
  {
    id: "2",
    title: "Speed & Agility Group",
    date: new Date(2025, 9, 1, 16, 0),
    time: "4:00 PM",
    type: "group",
    clients: ["Marcus Williams", "Emily Chen", "David Martinez"],
    link: "/session/2",
    status: "completed",
  },
  {
    id: "3",
    title: "Recovery & Mobility",
    date: new Date(2025, 9, 3, 9, 30),
    time: "9:30 AM",
    type: "1:1",
    clients: ["Alex Thompson"],
    link: "/session/3",
    status: "completed",
  },
  {
    id: "4",
    title: "Team Conditioning",
    date: new Date(2025, 9, 6, 14, 0),
    time: "2:00 PM",
    type: "group",
    clients: ["Ryan O'Connor", "Mia Patel", "Jordan Lee", "Sarah Johnson"],
    link: "/session/4",
    status: "completed",
  },
  {
    id: "5",
    title: "Performance Assessment",
    date: new Date(2025, 9, 8, 10, 0),
    time: "10:00 AM",
    type: "1:1",
    clients: ["Jessica Rodriguez"],
    link: "/session/5",
    status: "completed",
  },
  {
    id: "6",
    title: "Elite Performance Group",
    date: new Date(2025, 9, 10, 15, 30),
    time: "3:30 PM",
    type: "group",
    clients: ["Emily Chen", "David Martinez", "Alex Thompson"],
    link: "/session/6",
    status: "completed",
  },
  {
    id: "7",
    title: "Injury Prevention Training",
    date: new Date(2025, 9, 13, 11, 0),
    time: "11:00 AM",
    type: "1:1",
    clients: ["Marcus Williams"],
    link: "/session/7",
    status: "completed",
  },
  {
    id: "8",
    title: "Functional Movement",
    date: new Date(2025, 9, 15, 9, 0),
    time: "9:00 AM",
    type: "1:1",
    clients: ["Jordan Lee"],
    link: "/session/8",
    status: "completed",
  },
  {
    id: "9",
    title: "Cardio Conditioning Group",
    date: new Date(2025, 9, 17, 17, 0),
    time: "5:00 PM",
    type: "group",
    clients: ["Marcus Williams", "Jessica Rodriguez", "Ryan O'Connor", "Mia Patel"],
    link: "/session/9",
    status: "completed",
  },
  {
    id: "10",
    title: "Power Development",
    date: new Date(2025, 9, 20, 8, 30),
    time: "8:30 AM",
    type: "1:1",
    clients: ["Sarah Johnson"],
    link: "/session/10",
    status: "completed",
  },
  {
    id: "11",
    title: "Core Stability Training",
    date: new Date(2025, 9, 22, 10, 30),
    time: "10:30 AM",
    type: "1:1",
    clients: ["Emily Chen"],
    link: "/session/11",
    status: "completed",
  },
  {
    id: "12",
    title: "Advanced Training Group",
    date: new Date(2025, 9, 24, 18, 0),
    time: "6:00 PM",
    type: "group",
    clients: ["Alex Thompson", "Jordan Lee", "Sarah Johnson"],
    link: "/session/12",
    status: "completed",
  },
  {
    id: "13",
    title: "Strength & Power Session",
    date: new Date(2025, 9, 27, 14, 0),
    time: "2:00 PM",
    type: "1:1",
    clients: ["David Martinez"],
    link: "/session/13",
    status: "completed",
  },
  {
    id: "14",
    title: "Flexibility & Stretching",
    date: new Date(2025, 9, 29, 9, 0),
    time: "9:00 AM",
    type: "1:1",
    clients: ["Mia Patel"],
    link: "/session/14",
    status: "completed",
  },
  {
    id: "15",
    title: "Weekend Warrior Group",
    date: new Date(2025, 9, 31, 10, 0),
    time: "10:00 AM",
    type: "group",
    clients: ["Jessica Rodriguez", "Marcus Williams", "Emily Chen", "David Martinez"],
    link: "/session/15",
    status: "scheduled",
  },

  // November 2025 - Week 1
  {
    id: "16",
    title: "Endurance Training",
    date: new Date(2025, 10, 3, 7, 0),
    time: "7:00 AM",
    type: "1:1",
    clients: ["Alex Thompson"],
    link: "/session/16",
    status: "scheduled",
  },
  {
    id: "17",
    title: "High Intensity Group",
    date: new Date(2025, 10, 3, 16, 30),
    time: "4:30 PM",
    type: "group",
    clients: ["Jordan Lee", "Sarah Johnson", "Mia Patel"],
    link: "/session/17",
    status: "scheduled",
  },
  {
    id: "18",
    title: "Technique Refinement",
    date: new Date(2025, 10, 5, 11, 0),
    time: "11:00 AM",
    type: "1:1",
    clients: ["Marcus Williams"],
    link: "/session/18",
    status: "scheduled",
  },
  {
    id: "19",
    title: "Athletic Performance",
    date: new Date(2025, 10, 7, 15, 0),
    time: "3:00 PM",
    type: "1:1",
    clients: ["Emily Chen"],
    link: "/session/19",
    status: "scheduled",
  },
  {
    id: "20",
    title: "Team Building Workout",
    date: new Date(2025, 10, 10, 17, 30),
    time: "5:30 PM",
    type: "group",
    clients: ["Ryan O'Connor", "Jessica Rodriguez", "David Martinez", "Alex Thompson"],
    link: "/session/20",
    status: "scheduled",
  },
  {
    id: "21",
    title: "Recovery Protocol",
    date: new Date(2025, 10, 12, 9, 30),
    time: "9:30 AM",
    type: "1:1",
    clients: ["Jordan Lee"],
    link: "/session/21",
    status: "scheduled",
  },
  {
    id: "22",
    title: "Speed Training",
    date: new Date(2025, 10, 14, 13, 0),
    time: "1:00 PM",
    type: "1:1",
    clients: ["Sarah Johnson"],
    link: "/session/22",
    status: "scheduled",
  },
  {
    id: "23",
    title: "Power & Conditioning Group",
    date: new Date(2025, 10, 17, 14, 30),
    time: "2:30 PM",
    type: "group",
    clients: ["Marcus Williams", "Emily Chen", "David Martinez", "Mia Patel"],
    link: "/session/23",
    status: "scheduled",
  },
  {
    id: "24",
    title: "Mobility & Flexibility",
    date: new Date(2025, 10, 19, 10, 0),
    time: "10:00 AM",
    type: "1:1",
    clients: ["Alex Thompson"],
    link: "/session/24",
    status: "scheduled",
  },
  {
    id: "25",
    title: "Explosive Movement Training",
    date: new Date(2025, 10, 21, 16, 0),
    time: "4:00 PM",
    type: "1:1",
    clients: ["Ryan O'Connor"],
    link: "/session/25",
    status: "scheduled",
  },
  {
    id: "26",
    title: "Elite Athlete Group",
    date: new Date(2025, 10, 24, 18, 0),
    time: "6:00 PM",
    type: "group",
    clients: ["Jordan Lee", "Sarah Johnson", "Jessica Rodriguez"],
    link: "/session/26",
    status: "scheduled",
  },
  {
    id: "27",
    title: "Strength Assessment",
    date: new Date(2025, 10, 26, 9, 0),
    time: "9:00 AM",
    type: "1:1",
    clients: ["Emily Chen"],
    link: "/session/27",
    status: "scheduled",
  },
  {
    id: "28",
    title: "Thanksgiving Workout",
    date: new Date(2025, 10, 28, 8, 0),
    time: "8:00 AM",
    type: "group",
    clients: ["Marcus Williams", "David Martinez", "Alex Thompson", "Ryan O'Connor"],
    link: "/session/28",
    status: "scheduled",
  },
]

export function getSessionById(id: string): Session | undefined {
  console.log("[v0] Looking up session with id:", id)
  console.log(
    "[v0] Available sessions:",
    mockSessions.map((s) => ({ id: s.id, type: s.type, title: s.title })),
  )
  const session = mockSessions.find((session) => session.id === id)
  console.log("[v0] Found session:", session)
  return session
}

export function addSession(session: Session) {
  console.log("[v0] Adding session to global data:", session)
  mockSessions.push(session)
}

export function getAllSessions(): Session[] {
  return mockSessions
}
