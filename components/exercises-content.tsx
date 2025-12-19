"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Play, BookOpen, Target, Clock, TrendingUp, UserPlus, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

interface Exercise {
  id: string
  name: string
  description: string
  category: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  duration: string
  equipment: string[]
  muscles: string[]
  instructions: string[]
  benefits: string[]
  videoUrl?: string
}

const exerciseCategories = [
  { id: "all", name: "All Exercises", emoji: "🏋️" },
  { id: "warmup", name: "Warm-Up", emoji: "🔥" },
  { id: "strength", name: "Strength Training", emoji: "💪" },
  { id: "mobility", name: "Mobility & Flexibility", emoji: "🧘" },
  { id: "cardio", name: "Cardio", emoji: "🏃" },
  { id: "core", name: "Core & Stability", emoji: "🎯" },
  { id: "rehab", name: "Rehabilitation", emoji: "🏥" },
  { id: "sport-specific", name: "Sport-Specific", emoji: "⚽" },
]

// Hardcoded exercises - will be replaced by database fetch
const defaultExercises: Exercise[] = [
  {
    id: "1",
    name: "Dynamic Hip Flexor Stretch",
    description: "Improve hip mobility and reduce lower back tension with this dynamic stretching exercise.",
    category: "warmup",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["None"],
    muscles: ["Hip Flexors", "Quadriceps", "Lower Back"],
    instructions: [
      "Start in a lunge position with your right foot forward",
      "Keep your back leg straight and your front knee at 90 degrees",
      "Push your hips forward until you feel a stretch in your hip flexor",
      "Hold for 2-3 seconds, then return to start",
      "Repeat 10-12 times on each side"
    ],
    benefits: [
      "Improves hip mobility",
      "Reduces lower back tension",
      "Enhances running performance",
      "Prevents hip flexor tightness"
    ]
  },
  {
    id: "2",
    name: "Dead Bug",
    description: "A core stability exercise that improves coordination and strengthens deep core muscles.",
    category: "core",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Mat"],
    muscles: ["Transverse Abdominis", "Multifidus", "Core"],
    instructions: [
      "Lie on your back with arms extended toward ceiling",
      "Bend hips and knees to 90 degrees",
      "Slowly lower opposite arm and leg toward floor",
      "Keep your lower back pressed into the mat",
      "Return to start and alternate sides",
      "Perform 10-12 reps per side"
    ],
    benefits: [
      "Strengthens deep core muscles",
      "Improves coordination",
      "Reduces lower back pain",
      "Enhances stability"
    ]
  },
  {
    id: "3",
    name: "Bird Dog",
    description: "Improve spinal stability and coordination with this classic core exercise.",
    category: "core",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Mat"],
    muscles: ["Erector Spinae", "Glutes", "Core", "Shoulders"],
    instructions: [
      "Start on hands and knees in tabletop position",
      "Extend your right arm forward and left leg back simultaneously",
      "Keep your core engaged and avoid arching your back",
      "Hold for 2-3 seconds",
      "Return to start and alternate sides",
      "Perform 10-12 reps per side"
    ],
    benefits: [
      "Improves spinal stability",
      "Enhances coordination",
      "Strengthens posterior chain",
      "Reduces lower back pain"
    ]
  },
  {
    id: "4",
    name: "Cat-Cow Stretch",
    description: "A gentle spinal mobility exercise that improves flexibility and reduces stiffness.",
    category: "mobility",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["Mat"],
    muscles: ["Spinal Erectors", "Core", "Hip Flexors"],
    instructions: [
      "Start on hands and knees in tabletop position",
      "Arch your back and look up (Cow position)",
      "Round your back and tuck your chin (Cat position)",
      "Move slowly between positions",
      "Repeat 10-15 times"
    ],
    benefits: [
      "Improves spinal mobility",
      "Reduces back stiffness",
      "Enhances flexibility",
      "Relieves tension"
    ]
  },
  {
    id: "5",
    name: "Glute Bridge",
    description: "Activate and strengthen your glutes and posterior chain.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Mat"],
    muscles: ["Glutes", "Hamstrings", "Core"],
    instructions: [
      "Lie on your back with knees bent and feet flat on floor",
      "Engage your glutes and lift your hips off the ground",
      "Keep your core engaged and avoid arching your back",
      "Hold for 2-3 seconds at the top",
      "Lower slowly and repeat",
      "Perform 12-15 reps"
    ],
    benefits: [
      "Activates glutes",
      "Strengthens posterior chain",
      "Improves hip stability",
      "Reduces lower back pain"
    ]
  },
  {
    id: "6",
    name: "Plank",
    description: "Build core strength and stability with this foundational exercise.",
    category: "core",
    difficulty: "Intermediate",
    duration: "5-10 min",
    equipment: ["Mat"],
    muscles: ["Core", "Shoulders", "Glutes"],
    instructions: [
      "Start in push-up position with forearms on ground",
      "Keep your body in a straight line from head to heels",
      "Engage your core and glutes",
      "Hold for 30-60 seconds",
      "Rest and repeat 3-5 times"
    ],
    benefits: [
      "Builds core strength",
      "Improves stability",
      "Enhances posture",
      "Reduces injury risk"
    ]
  },
  {
    id: "7",
    name: "Side Plank",
    description: "Target your obliques and improve lateral core strength.",
    category: "core",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Mat"],
    muscles: ["Obliques", "Core", "Shoulders"],
    instructions: [
      "Lie on your side with forearm on ground",
      "Lift your hips to create a straight line",
      "Keep your core engaged",
      "Hold for 20-45 seconds per side",
      "Repeat 3-5 times per side"
    ],
    benefits: [
      "Strengthens obliques",
      "Improves lateral stability",
      "Enhances core strength",
      "Prevents side injuries"
    ]
  },
  {
    id: "8",
    name: "Thoracic Spine Rotation",
    description: "Improve upper back mobility and reduce stiffness.",
    category: "mobility",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["Mat"],
    muscles: ["Thoracic Spine", "Rotators", "Core"],
    instructions: [
      "Start on hands and knees",
      "Place one hand behind your head",
      "Rotate your upper body toward the ceiling",
      "Feel the stretch in your upper back",
      "Return to start and repeat",
      "Perform 10-12 reps per side"
    ],
    benefits: [
      "Improves thoracic mobility",
      "Reduces upper back stiffness",
      "Enhances rotation",
      "Prevents shoulder issues"
    ]
  },
  {
    id: "9",
    name: "Single Leg Balance",
    description: "Improve balance, proprioception, and ankle stability.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Ankle Stabilizers", "Core", "Proprioceptors"],
    instructions: [
      "Stand on one leg with slight knee bend",
      "Keep your core engaged and maintain balance",
      "Hold for 30-60 seconds",
      "Switch legs and repeat",
      "Progress by closing eyes or adding movement"
    ],
    benefits: [
      "Improves balance",
      "Enhances proprioception",
      "Strengthens ankle stabilizers",
      "Reduces injury risk"
    ]
  },
  {
    id: "10",
    name: "Wall Sit",
    description: "Build lower body endurance and strength.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Wall"],
    muscles: ["Quadriceps", "Glutes", "Core"],
    instructions: [
      "Lean against a wall with feet shoulder-width apart",
      "Slide down until knees are at 90 degrees",
      "Keep your back flat against the wall",
      "Hold for 30-60 seconds",
      "Rest and repeat 3-5 times"
    ],
    benefits: [
      "Builds leg strength",
      "Improves endurance",
      "Enhances stability",
      "Low impact exercise"
    ]
  },
  {
    id: "11",
    name: "High Knees",
    description: "A dynamic warm-up exercise that improves coordination and cardiovascular fitness.",
    category: "warmup",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["None"],
    muscles: ["Hip Flexors", "Quadriceps", "Core", "Cardiovascular"],
    instructions: [
      "Stand tall with feet hip-width apart",
      "Lift your knees toward your chest alternately",
      "Pump your arms naturally",
      "Maintain a quick, rhythmic pace",
      "Perform for 30-60 seconds",
      "Rest and repeat 3-5 times"
    ],
    benefits: [
      "Warms up the body",
      "Improves coordination",
      "Enhances cardiovascular fitness",
      "Activates hip flexors"
    ]
  },
  {
    id: "12",
    name: "Jump Squat",
    description: "Develop explosive power and lower body strength.",
    category: "strength",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Quadriceps", "Glutes", "Calves", "Core"],
    instructions: [
      "Start in a squat position",
      "Explosively jump up as high as possible",
      "Land softly back in squat position",
      "Immediately go into next rep",
      "Perform 8-12 reps",
      "Rest 60-90 seconds between sets"
    ],
    benefits: [
      "Develops explosive power",
      "Builds lower body strength",
      "Improves athletic performance",
      "Enhances coordination"
    ]
  }
]

export default function ExercisesContent() {
  const { data: session } = useSession()
  const [exercises, setExercises] = useState<Exercise[]>(defaultExercises)
  const [isLoadingExercises, setIsLoadingExercises] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all")
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [isPrescribeDialogOpen, setIsPrescribeDialogOpen] = useState(false)
  const [clients, setClients] = useState<Array<{ subject_id: string; name: string }>>([])
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [weeklyFrequency, setWeeklyFrequency] = useState(3)
  const [isPrescribing, setIsPrescribing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const exercisesPerPage = 12

  // Fetch exercises from database
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch("/api/exercise-catalog")
        if (response.ok) {
          const data = await response.json()
          if (data.exercises && data.exercises.length > 0) {
            setExercises(data.exercises)
          }
        }
      } catch (error) {
        console.error("Error fetching exercises:", error)
      } finally {
        setIsLoadingExercises(false)
      }
    }

    fetchExercises()
  }, [])

  // Fetch clients when prescribe dialog opens
  useEffect(() => {
    if (isPrescribeDialogOpen && session) {
      const fetchClients = async () => {
        try {
          const response = await fetch("/api/subjects")
          if (response.ok) {
            const data = await response.json()
            setClients(data.subjects || [])
          }
        } catch (error) {
          console.error("Error fetching clients:", error)
        }
      }
      fetchClients()
    }
  }, [isPrescribeDialogOpen, session])

  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.muscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === "all" || exercise.category === selectedCategory
    const matchesDifficulty = selectedDifficulty === "all" || exercise.difficulty === selectedDifficulty

    return matchesSearch && matchesCategory && matchesDifficulty
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredExercises.length / exercisesPerPage)
  const startIndex = (currentPage - 1) * exercisesPerPage
  const endIndex = startIndex + exercisesPerPage
  const paginatedExercises = filteredExercises.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory, selectedDifficulty])

  const handlePrescribe = () => {
    if (!selectedExercise) return
    setSelectedClients([])
    setWeeklyFrequency(3)
    setIsPrescribeDialogOpen(true)
  }

  const handlePrescribeSubmit = async () => {
    if (!selectedExercise || selectedClients.length === 0) {
      toast.error("Please select at least one client")
      return
    }

    setIsPrescribing(true)
    try {
      const response = await fetch("/api/prescribed-exercises/prescribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: selectedExercise.id,
          subjectIds: selectedClients,
          weeklyFrequency,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to prescribe exercise")
      }

      toast.success("Exercise prescribed successfully", {
        description: `Prescribed to ${selectedClients.length} client(s)`,
      })
      setIsPrescribeDialogOpen(false)
      setSelectedExercise(null)
    } catch (error: any) {
      toast.error("Error prescribing exercise", {
        description: error.message,
      })
    } finally {
      setIsPrescribing(false)
    }
  }

  const toggleClient = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    )
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-500/10 text-green-700 dark:text-green-400"
      case "Intermediate":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
      case "Advanced":
        return "bg-red-500/10 text-red-700 dark:text-red-400"
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400"
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Exercise Catalog</h1>
        <p className="text-muted-foreground">
          Browse our comprehensive library of exercises for strength, mobility, and rehabilitation
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search exercises by name, description, or muscle group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Difficulties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 h-auto">
            {exerciseCategories.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="flex flex-col gap-1 py-3 data-[state=active]:bg-accent"
              >
                <span className="text-lg">{category.emoji}</span>
                <span className="text-xs hidden sm:inline">{category.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Results Count */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredExercises.length)} of {filteredExercises.length} exercises
        </div>
        {totalPages > 1 && (
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        )}
      </div>

      {/* Exercise Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedExercises.map((exercise) => (
          <Card
            key={exercise.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedExercise(exercise)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{exercise.name}</CardTitle>
                <Badge className={getDifficultyColor(exercise.difficulty)}>
                  {exercise.difficulty}
                </Badge>
              </div>
              <CardDescription className="line-clamp-2">
                {exercise.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{exercise.duration}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exercise.muscles.slice(0, 3).map((muscle) => (
                    <Badge key={muscle} variant="outline" className="text-xs">
                      {muscle}
                    </Badge>
                  ))}
                  {exercise.muscles.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{exercise.muscles.length - 3} more
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Play className="h-4 w-4 text-primary" />
                  <span className="text-primary font-medium">View Details</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first page, last page, current page, and pages around current
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="min-w-[40px]"
                  >
                    {page}
                  </Button>
                )
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <span key={page} className="px-2 text-muted-foreground">
                    ...
                  </span>
                )
              }
              return null
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedExercise(null)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{selectedExercise.name}</CardTitle>
                  <CardDescription className="text-base">
                    {selectedExercise.description}
                  </CardDescription>
                </div>
                <Badge className={getDifficultyColor(selectedExercise.difficulty)}>
                  {selectedExercise.difficulty}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Duration</p>
                    <p className="text-sm text-muted-foreground">{selectedExercise.duration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Equipment</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedExercise.equipment.join(", ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Muscles Targeted */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Muscles Targeted
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedExercise.muscles.map((muscle) => (
                    <Badge key={muscle} variant="outline">
                      {muscle}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Instructions
                </h3>
                <ol className="space-y-2">
                  {selectedExercise.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="font-semibold text-primary">{index + 1}.</span>
                      <span className="text-muted-foreground">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Benefits */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Benefits
                </h3>
                <ul className="space-y-2">
                  {selectedExercise.benefits.map((benefit, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="text-primary">•</span>
                      <span className="text-muted-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prescribe and Close Buttons */}
              <div className="pt-4 border-t flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handlePrescribe}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Prescribe to Clients
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedExercise(null)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {filteredExercises.length === 0 && !isLoadingExercises && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No exercises found matching your criteria.</p>
          <p className="text-muted-foreground text-sm mt-2">
            Try adjusting your search or filters.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoadingExercises && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-4">Loading exercises...</p>
        </div>
      )}

      {/* Prescribe Dialog */}
      <Dialog open={isPrescribeDialogOpen} onOpenChange={setIsPrescribeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescribe Exercise</DialogTitle>
            <DialogDescription>
              Select clients to prescribe "{selectedExercise?.name}" to and set weekly frequency.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Weekly Frequency */}
            <div className="space-y-2">
              <Label htmlFor="frequency">Weekly Frequency</Label>
              <Select
                value={weeklyFrequency.toString()}
                onValueChange={(value) => setWeeklyFrequency(parseInt(value))}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} time{num !== 1 ? "s" : ""} per week
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Select Clients</Label>
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No clients found. Add clients first.
                  </p>
                ) : (
                  clients.map((client) => (
                    <div
                      key={client.subject_id}
                      className="flex items-center space-x-2 p-2 hover:bg-accent rounded"
                    >
                      <Checkbox
                        id={`client-${client.subject_id}`}
                        checked={selectedClients.includes(client.subject_id)}
                        onCheckedChange={() => toggleClient(client.subject_id)}
                      />
                      <label
                        htmlFor={`client-${client.subject_id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {client.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsPrescribeDialogOpen(false)}
                disabled={isPrescribing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handlePrescribeSubmit}
                disabled={isPrescribing || selectedClients.length === 0}
              >
                {isPrescribing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Prescribing...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Prescribe to {selectedClients.length} Client{selectedClients.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


