"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Play, Clock, Maximize2, Minimize2 } from "lucide-react"

interface Video {
  id: string
  title: string
  description: string
  duration: string
  category: string
  type: "exercise" | "taping"
  thumbnail: string
  difficulty?: "Beginner" | "Intermediate" | "Advanced"
}

const videos: Video[] = [
  {
    id: "1",
    title: "Dynamic Hip Flexor Stretch",
    description: "Improve hip mobility and flexibility with this dynamic stretching routine",
    duration: "8:45",
    category: "Lower Body",
    type: "exercise",
    thumbnail: "/athlete-stretching-hip-flexor.jpg",
    difficulty: "Beginner",
  },
  {
    id: "2",
    title: "Kinesiology Taping for Lower Back",
    description: "Step-by-step guide for applying K-tape to support lower back muscles",
    duration: "12:30",
    category: "Taping Techniques",
    type: "taping",
    thumbnail: "/kinesiology-tape-lower-back.jpg",
    difficulty: "Intermediate",
  },
  {
    id: "3",
    title: "Single-Leg Romanian Deadlift",
    description: "Master proper form for this essential posterior chain exercise",
    duration: "10:15",
    category: "Lower Body",
    type: "exercise",
    thumbnail: "/single-leg-deadlift-athlete.jpg",
    difficulty: "Intermediate",
  },
  {
    id: "4",
    title: "Shoulder Stability Exercises",
    description: "Build rotator cuff strength and shoulder stability",
    duration: "15:20",
    category: "Upper Body",
    type: "exercise",
    thumbnail: "/shoulder-stability-exercise.jpg",
    difficulty: "Advanced",
  },
  {
    id: "5",
    title: "K-Tape Application for Knee Support",
    description: "Proper taping technique for patellar tendon support",
    duration: "9:45",
    category: "Taping Techniques",
    type: "taping",
    thumbnail: "/knee-taping-technique.jpg",
    difficulty: "Beginner",
  },
  {
    id: "6",
    title: "Core Stability Circuit",
    description: "Advanced core exercises for athletic performance",
    duration: "18:00",
    category: "Core",
    type: "exercise",
    thumbnail: "/core-stability-training.jpg",
    difficulty: "Advanced",
  },
  {
    id: "7",
    title: "Ankle Taping for Stability",
    description: "Comprehensive ankle support taping for athletes",
    duration: "11:20",
    category: "Taping Techniques",
    type: "taping",
    thumbnail: "/ankle-taping-athletic.jpg",
    difficulty: "Intermediate",
  },
  {
    id: "8",
    title: "Kettlebell Swing Technique",
    description: "Perfect your kettlebell swing for power development",
    duration: "7:30",
    category: "Lower Body",
    type: "exercise",
    thumbnail: "/kettlebell-swing-athlete.jpg",
    difficulty: "Intermediate",
  },
  {
    id: "9",
    title: "Thoracic Spine Mobility",
    description: "Improve upper back mobility for better movement patterns",
    duration: "13:15",
    category: "Upper Body",
    type: "exercise",
    thumbnail: "/thoracic-spine-mobility.jpg",
    difficulty: "Beginner",
  },
]

const categories = ["All", "Exercise Videos", "Taping Techniques", "Upper Body", "Lower Body", "Core"]

export default function OfflineProgramsContent() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const filteredVideos = videos.filter((video) => {
    if (selectedCategory === "All") return true
    if (selectedCategory === "Exercise Videos") return video.type === "exercise"
    if (selectedCategory === "Taping Techniques") return video.type === "taping"
    return video.category === selectedCategory
  })

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-500/20 text-green-700 border-green-500/30"
      case "Intermediate":
        return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30"
      case "Advanced":
        return "bg-red-500/20 text-red-700 border-red-500/30"
      default:
        return "bg-gray-500/20 text-gray-700 border-gray-500/30"
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 pl-12">
          <h1 className="text-3xl font-bold text-foreground mb-2">Offline Programs</h1>
          <p className="text-muted-foreground">Exercise videos and kinesiology taping techniques</p>
        </div>

        {/* Category Filters */}
        <div className="mb-8 flex flex-wrap gap-3">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="rounded-full"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Card
              key={video.id}
              onClick={() => setSelectedVideo(video)}
              className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-border/50 bg-card group"
            >
              {/* Video Thumbnail */}
              <div className="relative aspect-video bg-muted overflow-hidden">
                <img
                  src={video.thumbnail || "/placeholder.svg"}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-white rounded-full p-4">
                    <Play className="h-8 w-8 text-black fill-black" />
                  </div>
                </div>
                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {video.duration}
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-foreground line-clamp-2">{video.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{video.description}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {video.category}
                  </Badge>
                  {video.difficulty && (
                    <Badge variant="outline" className={`text-xs ${getDifficultyColor(video.difficulty)}`}>
                      {video.difficulty}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredVideos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No videos found in this category</p>
          </div>
        )}
      </div>

      {/* Video Modal */}
      <Dialog
        open={!!selectedVideo}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVideo(null)
            setIsFullscreen(false)
          }
        }}
      >
        <DialogContent
          className={`${isFullscreen ? "!max-w-none w-screen h-screen p-0 !sm:max-w-none" : "!max-w-[min(1920px,95vw)] w-[95vw] max-h-[90vh] !sm:max-w-[min(1920px,95vw)]"} overflow-hidden`}
        >
          {selectedVideo && (
            <div className={`${isFullscreen ? "p-6 h-full flex flex-col" : ""}`}>
              <DialogHeader className="relative mb-4">
                <DialogTitle className="text-2xl font-bold pr-12">{selectedVideo.title}</DialogTitle>
                <DialogDescription className="sr-only">Video details for {selectedVideo.title}</DialogDescription>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="absolute right-10 top-0 hover:bg-accent"
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
              </DialogHeader>

              <div
                className={`${isFullscreen ? "flex-1 flex flex-col gap-4" : "grid md:grid-cols-[1.5fr,1fr] gap-6"} overflow-y-auto`}
              >
                {/* Video Player */}
                <div
                  className={`relative ${
                    isFullscreen ? "flex-1 min-h-0" : "aspect-video"
                  } bg-muted rounded-lg overflow-hidden`}
                >
                  <img
                    src={selectedVideo.thumbnail || "/placeholder.svg"}
                    alt={selectedVideo.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/50 transition-colors">
                    <div className="bg-white rounded-full p-8 hover:scale-110 transition-transform cursor-pointer shadow-2xl">
                      <Play className="h-16 w-16 text-black fill-black" />
                    </div>
                  </div>
                  {/* Duration Badge */}
                  <div className="absolute bottom-4 right-4 bg-black/90 text-white px-4 py-2 rounded-lg text-base flex items-center gap-2 font-medium">
                    <Clock className="h-5 w-5" />
                    {selectedVideo.duration}
                  </div>
                </div>

                {/* Video Details */}
                <div className={`space-y-6 ${isFullscreen ? "" : "overflow-y-auto"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {selectedVideo.category}
                    </Badge>
                    {selectedVideo.difficulty && (
                      <Badge
                        variant="outline"
                        className={`text-sm px-3 py-1 ${getDifficultyColor(selectedVideo.difficulty)}`}
                      >
                        {selectedVideo.difficulty}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {selectedVideo.type === "exercise" ? "Exercise Video" : "Taping Technique"}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-muted-foreground mb-3">Description</h3>
                    <p className="text-foreground leading-relaxed text-base">{selectedVideo.description}</p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-muted-foreground mb-3">Key Points</h3>
                    <ul className="space-y-2 text-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Focus on proper form and controlled movements</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Maintain steady breathing throughout the exercise</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Progress gradually to avoid injury</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-muted-foreground mb-3">Equipment Needed</h3>
                    <p className="text-foreground">
                      {selectedVideo.type === "taping"
                        ? "Kinesiology tape, scissors, alcohol wipes"
                        : "Exercise mat, comfortable athletic wear"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
