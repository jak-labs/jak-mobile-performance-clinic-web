import { NextRequest, NextResponse } from "next/server"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"

const client = new DynamoDBClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || "us-east-2",
  credentials:
    (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
    (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
      ? {
          accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
})

const docClient = DynamoDBDocumentClient.from(client)
const EXERCISE_CATALOG_TABLE = "jak-exercise-catalog"

// Initial exercises data
const initialExercises = [
  {
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
  },
  // Weight Lifting Exercises
  {
    name: "Barbell Back Squat",
    description: "The king of lower body exercises. Builds leg strength, glutes, and core stability.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "20-30 min",
    equipment: ["Barbell", "Squat Rack", "Weight Plates"],
    muscles: ["Quadriceps", "Glutes", "Hamstrings", "Core", "Calves"],
    instructions: [
      "Set barbell on upper back, feet shoulder-width apart",
      "Keep chest up and core tight",
      "Lower until thighs parallel to floor",
      "Drive through heels to stand",
      "Perform 3-5 sets of 5-8 reps"
    ],
    benefits: ["Builds leg strength", "Increases muscle mass", "Improves athletic performance", "Strengthens core"]
  },
  {
    name: "Barbell Bench Press",
    description: "Classic upper body strength builder targeting chest, shoulders, and triceps.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "20-30 min",
    equipment: ["Barbell", "Bench", "Weight Plates"],
    muscles: ["Pectorals", "Anterior Deltoids", "Triceps"],
    instructions: [
      "Lie on bench, grip bar slightly wider than shoulders",
      "Lower bar to chest with control",
      "Press up explosively",
      "Keep feet flat on floor",
      "Perform 3-5 sets of 5-8 reps"
    ],
    benefits: ["Builds upper body strength", "Increases chest size", "Improves pressing power", "Develops triceps"]
  },
  {
    name: "Deadlift",
    description: "Full-body strength exercise that builds posterior chain and core.",
    category: "strength",
    difficulty: "Advanced",
    duration: "20-30 min",
    equipment: ["Barbell", "Weight Plates"],
    muscles: ["Hamstrings", "Glutes", "Erector Spinae", "Lats", "Core", "Traps"],
    instructions: [
      "Stand with feet hip-width, bar over mid-foot",
      "Hinge at hips, keep back straight",
      "Grip bar, drive through heels",
      "Stand tall, squeeze glutes at top",
      "Lower with control",
      "Perform 3-5 sets of 3-6 reps"
    ],
    benefits: ["Builds full-body strength", "Improves posture", "Increases grip strength", "Develops posterior chain"]
  },
  {
    name: "Overhead Press",
    description: "Builds shoulder strength and stability while engaging core.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Barbell", "Weight Plates"],
    muscles: ["Shoulders", "Triceps", "Core", "Upper Back"],
    instructions: [
      "Stand with feet hip-width, bar at shoulder height",
      "Press bar overhead, keep core tight",
      "Lower with control",
      "Keep elbows slightly forward",
      "Perform 3-4 sets of 6-10 reps"
    ],
    benefits: ["Builds shoulder strength", "Improves overhead stability", "Strengthens core", "Develops triceps"]
  },
  {
    name: "Barbell Row",
    description: "Builds back thickness and pulling strength.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Barbell", "Weight Plates"],
    muscles: ["Lats", "Rhomboids", "Middle Traps", "Rear Delts", "Biceps"],
    instructions: [
      "Bend at hips, keep back straight",
      "Pull bar to lower chest/upper abdomen",
      "Squeeze shoulder blades together",
      "Lower with control",
      "Perform 3-4 sets of 8-12 reps"
    ],
    benefits: ["Builds back thickness", "Improves posture", "Strengthens pulling muscles", "Develops biceps"]
  },
  {
    name: "Dumbbell Shoulder Press",
    description: "Unilateral shoulder strength builder with greater range of motion.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Dumbbells", "Bench"],
    muscles: ["Shoulders", "Triceps", "Core"],
    instructions: [
      "Sit on bench, hold dumbbells at shoulder height",
      "Press up and slightly forward",
      "Lower with control",
      "Keep core engaged",
      "Perform 3-4 sets of 8-12 reps"
    ],
    benefits: ["Builds shoulder strength", "Improves stability", "Allows greater range of motion", "Unilateral training"]
  },
  {
    name: "Dumbbell Chest Press",
    description: "Unilateral chest exercise with greater range of motion than barbell.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Dumbbells", "Bench"],
    muscles: ["Pectorals", "Anterior Deltoids", "Triceps"],
    instructions: [
      "Lie on bench, hold dumbbells at chest level",
      "Press up and together",
      "Lower with control, feel stretch in chest",
      "Keep feet flat on floor",
      "Perform 3-4 sets of 8-12 reps"
    ],
    benefits: ["Builds chest strength", "Greater range of motion", "Unilateral training", "Improves stability"]
  },
  {
    name: "Dumbbell Row",
    description: "Unilateral back exercise for balanced development.",
    category: "strength",
    difficulty: "Beginner",
    duration: "15-20 min",
    equipment: ["Dumbbells", "Bench"],
    muscles: ["Lats", "Rhomboids", "Rear Delts", "Biceps"],
    instructions: [
      "Place knee and hand on bench, other foot on floor",
      "Pull dumbbell to hip, squeeze shoulder blade",
      "Lower with control",
      "Keep core engaged",
      "Perform 3-4 sets of 10-15 reps per side"
    ],
    benefits: ["Builds back strength", "Unilateral training", "Improves muscle imbalances", "Core stability"]
  },
  {
    name: "Barbell Bicep Curl",
    description: "Isolation exercise for bicep development.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Barbell", "Weight Plates"],
    muscles: ["Biceps", "Forearms"],
    instructions: [
      "Stand with feet hip-width, hold bar with underhand grip",
      "Curl bar to shoulders, squeeze biceps",
      "Lower with control",
      "Keep elbows at sides",
      "Perform 3-4 sets of 10-15 reps"
    ],
    benefits: ["Builds bicep size", "Improves arm strength", "Develops forearms", "Isolation training"]
  },
  {
    name: "Tricep Dips",
    description: "Bodyweight exercise for tricep and shoulder strength.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Bench", "Chair"],
    muscles: ["Triceps", "Anterior Deltoids", "Chest"],
    instructions: [
      "Sit on edge of bench, hands gripping edge",
      "Slide forward, support weight with arms",
      "Lower body by bending elbows",
      "Press up to start position",
      "Perform 3-4 sets of 8-15 reps"
    ],
    benefits: ["Builds tricep strength", "No equipment needed", "Improves pushing power", "Core engagement"]
  },
  {
    name: "Pull-Ups",
    description: "Ultimate upper body pulling exercise.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Pull-up Bar"],
    muscles: ["Lats", "Biceps", "Rhomboids", "Rear Delts", "Core"],
    instructions: [
      "Hang from bar with overhand grip",
      "Pull body up until chin over bar",
      "Lower with control",
      "Keep core engaged",
      "Perform 3-4 sets to failure"
    ],
    benefits: ["Builds back strength", "Improves grip strength", "Full upper body workout", "Bodyweight exercise"]
  },
  {
    name: "Push-Ups",
    description: "Classic bodyweight pushing exercise for chest and triceps.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Pectorals", "Triceps", "Anterior Deltoids", "Core"],
    instructions: [
      "Start in plank position, hands slightly wider than shoulders",
      "Lower body until chest nearly touches ground",
      "Press up explosively",
      "Keep body in straight line",
      "Perform 3-4 sets of 10-20 reps"
    ],
    benefits: ["Builds upper body strength", "No equipment needed", "Core engagement", "Improves pushing power"]
  },
  {
    name: "Lunges",
    description: "Unilateral lower body exercise for strength and balance.",
    category: "strength",
    difficulty: "Beginner",
    duration: "15-20 min",
    equipment: ["None", "Dumbbells"],
    muscles: ["Quadriceps", "Glutes", "Hamstrings", "Calves", "Core"],
    instructions: [
      "Step forward into lunge position",
      "Lower back knee toward ground",
      "Front thigh parallel to floor",
      "Push through front heel to return",
      "Alternate legs",
      "Perform 3-4 sets of 12-20 reps per leg"
    ],
    benefits: ["Builds leg strength", "Improves balance", "Unilateral training", "Core stability"]
  },
  {
    name: "Romanian Deadlift",
    description: "Hip-hinge exercise targeting hamstrings and glutes.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Barbell", "Dumbbells"],
    muscles: ["Hamstrings", "Glutes", "Erector Spinae", "Core"],
    instructions: [
      "Hold weight, slight knee bend",
      "Hinge at hips, push hips back",
      "Feel stretch in hamstrings",
      "Return to standing, squeeze glutes",
      "Keep back straight throughout",
      "Perform 3-4 sets of 8-12 reps"
    ],
    benefits: ["Builds hamstring strength", "Improves hip mobility", "Posterior chain development", "Core stability"]
  },
  {
    name: "Leg Press",
    description: "Machine-based leg exercise for quadriceps and glutes.",
    category: "strength",
    difficulty: "Beginner",
    duration: "15-20 min",
    equipment: ["Leg Press Machine"],
    muscles: ["Quadriceps", "Glutes", "Hamstrings", "Calves"],
    instructions: [
      "Sit in machine, feet shoulder-width on platform",
      "Lower weight by bending knees",
      "Press through heels to extend legs",
      "Don't lock knees at top",
      "Perform 3-4 sets of 10-15 reps"
    ],
    benefits: ["Builds leg strength", "Safer than squats", "High volume training", "Isolates legs"]
  },
  {
    name: "Lat Pulldown",
    description: "Machine exercise for building wide back muscles.",
    category: "strength",
    difficulty: "Beginner",
    duration: "15-20 min",
    equipment: ["Cable Machine"],
    muscles: ["Lats", "Biceps", "Rhomboids", "Rear Delts"],
    instructions: [
      "Sit at machine, grip bar wider than shoulders",
      "Pull bar to upper chest",
      "Squeeze shoulder blades together",
      "Control the weight up",
      "Perform 3-4 sets of 10-12 reps"
    ],
    benefits: ["Builds back width", "Easier than pull-ups", "Controlled movement", "Beginners friendly"]
  },
  {
    name: "Cable Flyes",
    description: "Isolation exercise for chest muscles with constant tension.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Cable Machine"],
    muscles: ["Pectorals", "Anterior Deltoids"],
    instructions: [
      "Set cables at chest height",
      "Stand between cables, slight forward lean",
      "Bring handles together in arc motion",
      "Feel stretch in chest",
      "Control return",
      "Perform 3-4 sets of 12-15 reps"
    ],
    benefits: ["Isolates chest", "Constant tension", "Improves chest definition", "Greater range of motion"]
  },
  {
    name: "Leg Curl",
    description: "Isolation exercise for hamstring development.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Leg Curl Machine"],
    muscles: ["Hamstrings"],
    instructions: [
      "Lie face down on machine",
      "Curl heels toward glutes",
      "Squeeze hamstrings at top",
      "Lower with control",
      "Perform 3-4 sets of 12-15 reps"
    ],
    benefits: ["Isolates hamstrings", "Builds leg balance", "Injury prevention", "Rehabilitation"]
  },
  {
    name: "Leg Extension",
    description: "Isolation exercise for quadriceps development.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Leg Extension Machine"],
    muscles: ["Quadriceps"],
    instructions: [
      "Sit in machine, shins against pad",
      "Extend legs, squeeze quads",
      "Lower with control",
      "Don't lock knees",
      "Perform 3-4 sets of 12-15 reps"
    ],
    benefits: ["Isolates quadriceps", "Builds leg definition", "Rehabilitation", "Knee strengthening"]
  },
  {
    name: "Calf Raises",
    description: "Isolation exercise for calf development.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None", "Dumbbells", "Machine"],
    muscles: ["Calves", "Gastrocnemius", "Soleus"],
    instructions: [
      "Stand on balls of feet",
      "Rise up onto toes",
      "Squeeze calves at top",
      "Lower with control",
      "Perform 3-4 sets of 15-20 reps"
    ],
    benefits: ["Builds calf size", "Improves ankle stability", "No equipment needed", "Quick exercise"]
  },
  // Aerobic Exercises
  {
    name: "Running",
    description: "Classic aerobic exercise for cardiovascular fitness and endurance.",
    category: "cardio",
    difficulty: "Beginner",
    duration: "20-60 min",
    equipment: ["Running Shoes"],
    muscles: ["Quadriceps", "Hamstrings", "Calves", "Glutes", "Core", "Cardiovascular"],
    instructions: [
      "Start with 5-minute warm-up walk",
      "Maintain steady pace, can hold conversation",
      "Land on mid-foot, not heel",
      "Keep posture upright",
      "Cool down with 5-minute walk",
      "Run 20-60 minutes based on fitness level"
    ],
    benefits: ["Improves cardiovascular health", "Burns calories", "Builds endurance", "Mental health benefits"]
  },
  {
    name: "Cycling",
    description: "Low-impact aerobic exercise for cardiovascular fitness.",
    category: "cardio",
    difficulty: "Beginner",
    duration: "30-60 min",
    equipment: ["Bicycle", "Stationary Bike"],
    muscles: ["Quadriceps", "Hamstrings", "Glutes", "Calves", "Cardiovascular"],
    instructions: [
      "Adjust seat height, slight knee bend at bottom",
      "Maintain steady cadence 80-100 RPM",
      "Keep core engaged",
      "Vary intensity with resistance/terrain",
      "Cycle 30-60 minutes"
    ],
    benefits: ["Low impact", "Builds leg strength", "Cardiovascular fitness", "Outdoor or indoor"]
  },
  {
    name: "Swimming",
    description: "Full-body aerobic exercise with zero impact.",
    category: "cardio",
    difficulty: "Intermediate",
    duration: "20-45 min",
    equipment: ["Pool", "Swimsuit"],
    muscles: ["Full Body", "Cardiovascular", "Core", "Shoulders", "Back"],
    instructions: [
      "Warm up with easy laps",
      "Use proper stroke technique",
      "Breathe rhythmically",
      "Maintain steady pace",
      "Cool down with easy swimming",
      "Swim 20-45 minutes"
    ],
    benefits: ["Zero impact", "Full body workout", "Cardiovascular fitness", "Improves flexibility"]
  },
  {
    name: "Jumping Jacks",
    description: "Simple aerobic exercise for warm-up and cardio.",
    category: "cardio",
    difficulty: "Beginner",
    duration: "5-15 min",
    equipment: ["None"],
    muscles: ["Full Body", "Cardiovascular", "Shoulders", "Legs"],
    instructions: [
      "Stand with feet together, arms at sides",
      "Jump feet apart, raise arms overhead",
      "Jump feet together, lower arms",
      "Maintain steady rhythm",
      "Perform 3-5 sets of 30-60 seconds"
    ],
    benefits: ["No equipment needed", "Full body movement", "Cardiovascular fitness", "Quick warm-up"]
  },
  {
    name: "Burpees",
    description: "High-intensity full-body aerobic exercise.",
    category: "cardio",
    difficulty: "Intermediate",
    duration: "10-20 min",
    equipment: ["None"],
    muscles: ["Full Body", "Cardiovascular", "Legs", "Chest", "Core"],
    instructions: [
      "Start standing, squat down",
      "Jump feet back to plank",
      "Do push-up (optional)",
      "Jump feet forward",
      "Jump up with arms overhead",
      "Perform 3-5 sets of 10-20 reps"
    ],
    benefits: ["Full body workout", "High calorie burn", "No equipment", "Builds endurance"]
  },
  {
    name: "Mountain Climbers",
    description: "High-intensity cardio exercise targeting core and legs.",
    category: "cardio",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Core", "Shoulders", "Legs", "Cardiovascular"],
    instructions: [
      "Start in plank position",
      "Alternate bringing knees to chest quickly",
      "Keep core engaged",
      "Maintain steady pace",
      "Perform 3-5 sets of 30-60 seconds"
    ],
    benefits: ["Cardiovascular fitness", "Core strength", "No equipment", "Full body engagement"]
  },
  {
    name: "Rowing",
    description: "Full-body aerobic exercise using rowing machine.",
    category: "cardio",
    difficulty: "Intermediate",
    duration: "20-40 min",
    equipment: ["Rowing Machine"],
    muscles: ["Legs", "Back", "Arms", "Core", "Cardiovascular"],
    instructions: [
      "Start with legs extended, arms forward",
      "Drive with legs, lean back slightly",
      "Pull arms to chest",
      "Return in reverse order",
      "Maintain steady rhythm",
      "Row 20-40 minutes"
    ],
    benefits: ["Full body workout", "Low impact", "Cardiovascular fitness", "Builds endurance"]
  },
  {
    name: "Elliptical",
    description: "Low-impact aerobic exercise for cardiovascular fitness.",
    category: "cardio",
    difficulty: "Beginner",
    duration: "20-45 min",
    equipment: ["Elliptical Machine"],
    muscles: ["Legs", "Glutes", "Cardiovascular"],
    instructions: [
      "Step onto machine, hold handles",
      "Maintain smooth elliptical motion",
      "Vary resistance and incline",
      "Keep posture upright",
      "Use 20-45 minutes"
    ],
    benefits: ["Low impact", "Cardiovascular fitness", "Full body option", "Easy on joints"]
  },
  {
    name: "Jump Rope",
    description: "High-intensity aerobic exercise for coordination and cardio.",
    category: "cardio",
    difficulty: "Intermediate",
    duration: "10-20 min",
    equipment: ["Jump Rope"],
    muscles: ["Calves", "Shoulders", "Core", "Cardiovascular"],
    instructions: [
      "Hold rope handles, rope behind feet",
      "Jump over rope, land on balls of feet",
      "Keep elbows close, wrists do the work",
      "Maintain steady rhythm",
      "Perform 3-5 sets of 1-3 minutes"
    ],
    benefits: ["Cardiovascular fitness", "Improves coordination", "Portable", "High calorie burn"]
  },
  {
    name: "Stair Climbing",
    description: "Aerobic exercise for lower body and cardiovascular fitness.",
    category: "cardio",
    difficulty: "Beginner",
    duration: "15-30 min",
    equipment: ["Stairs", "Stair Machine"],
    muscles: ["Quadriceps", "Glutes", "Calves", "Cardiovascular"],
    instructions: [
      "Step up one stair at a time",
      "Drive through heel",
      "Maintain steady pace",
      "Use handrail if needed",
      "Climb 15-30 minutes"
    ],
    benefits: ["Cardiovascular fitness", "Builds leg strength", "Low cost", "Accessible"]
  },
  // Anaerobic Exercises
  {
    name: "Sprint Intervals",
    description: "High-intensity anaerobic exercise for speed and power.",
    category: "cardio",
    difficulty: "Advanced",
    duration: "15-30 min",
    equipment: ["None", "Track"],
    muscles: ["Quadriceps", "Hamstrings", "Glutes", "Calves", "Cardiovascular"],
    instructions: [
      "Warm up with 5-minute jog",
      "Sprint at maximum effort for 20-30 seconds",
      "Recover with walk/jog for 60-90 seconds",
      "Repeat 6-10 times",
      "Cool down with 5-minute walk"
    ],
    benefits: ["Builds speed", "Improves power", "Anaerobic fitness", "Time efficient"]
  },
  {
    name: "Box Jumps",
    description: "Plyometric exercise for explosive power and leg strength.",
    category: "strength",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["Plyometric Box"],
    muscles: ["Quadriceps", "Glutes", "Calves", "Core"],
    instructions: [
      "Stand facing box, feet shoulder-width",
      "Jump onto box, land softly",
      "Step down, don't jump",
      "Rest 30-60 seconds between sets",
      "Perform 3-5 sets of 5-10 reps"
    ],
    benefits: ["Builds explosive power", "Improves athleticism", "Leg strength", "Plyometric training"]
  },
  {
    name: "Kettlebell Swings",
    description: "Explosive hip-hinge exercise for power and conditioning.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Kettlebell"],
    muscles: ["Hamstrings", "Glutes", "Core", "Shoulders", "Cardiovascular"],
    instructions: [
      "Stand with feet wider than shoulders",
      "Hinge at hips, swing kettlebell back",
      "Drive hips forward, swing to chest height",
      "Let momentum bring it back",
      "Perform 3-5 sets of 15-25 reps"
    ],
    benefits: ["Builds power", "Cardiovascular fitness", "Posterior chain", "Full body workout"]
  },
  {
    name: "Battle Ropes",
    description: "High-intensity anaerobic exercise for full-body conditioning.",
    category: "cardio",
    difficulty: "Intermediate",
    duration: "10-20 min",
    equipment: ["Battle Ropes"],
    muscles: ["Full Body", "Shoulders", "Core", "Cardiovascular"],
    instructions: [
      "Hold one rope in each hand",
      "Alternate slamming ropes up and down",
      "Keep core engaged",
      "Maintain steady rhythm",
      "Perform 3-5 sets of 30-60 seconds"
    ],
    benefits: ["Full body workout", "High intensity", "Cardiovascular fitness", "Builds power"]
  },
  {
    name: "Sled Push",
    description: "Full-body anaerobic exercise for power and conditioning.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Sled", "Weight Plates"],
    muscles: ["Legs", "Core", "Shoulders", "Cardiovascular"],
    instructions: [
      "Load sled with appropriate weight",
      "Push sled forward with explosive effort",
      "Maintain forward lean",
      "Drive through legs",
      "Perform 4-6 sets of 20-40 meters"
    ],
    benefits: ["Builds power", "Full body workout", "Cardiovascular fitness", "Athletic performance"]
  },
  {
    name: "Farmer's Walk",
    description: "Full-body strength and conditioning exercise.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Dumbbells", "Kettlebells"],
    muscles: ["Full Body", "Grip", "Core", "Legs", "Shoulders"],
    instructions: [
      "Pick up heavy weights in each hand",
      "Walk forward maintaining posture",
      "Keep core tight",
      "Walk 20-50 meters",
      "Rest and repeat",
      "Perform 3-5 sets"
    ],
    benefits: ["Builds grip strength", "Full body workout", "Core stability", "Functional strength"]
  },
  {
    name: "Tire Flips",
    description: "Full-body power exercise for strength and conditioning.",
    category: "strength",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["Tire"],
    muscles: ["Full Body", "Legs", "Back", "Core", "Cardiovascular"],
    instructions: [
      "Squat down, grip tire from underneath",
      "Drive through legs, flip tire over",
      "Repeat immediately",
      "Keep back straight",
      "Perform 3-5 sets of 5-10 flips"
    ],
    benefits: ["Builds power", "Full body workout", "Cardiovascular fitness", "Functional strength"]
  },
  {
    name: "Medicine Ball Slams",
    description: "Explosive full-body exercise for power and conditioning.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Medicine Ball"],
    muscles: ["Full Body", "Core", "Shoulders", "Cardiovascular"],
    instructions: [
      "Hold ball overhead",
      "Slam ball down with maximum force",
      "Catch ball on bounce",
      "Immediately repeat",
      "Perform 3-5 sets of 10-15 reps"
    ],
    benefits: ["Builds power", "Core strength", "Cardiovascular fitness", "Stress relief"]
  },
  {
    name: "Prowler Push",
    description: "Full-body anaerobic exercise for power and conditioning.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Prowler Sled"],
    muscles: ["Legs", "Core", "Shoulders", "Cardiovascular"],
    instructions: [
      "Load prowler with weight",
      "Push with explosive effort",
      "Maintain forward lean",
      "Drive through legs",
      "Perform 4-6 sets of 20-40 meters"
    ],
    benefits: ["Builds power", "Full body workout", "Cardiovascular fitness", "Athletic performance"]
  },
  {
    name: "Assault Bike",
    description: "High-intensity anaerobic exercise for full-body conditioning.",
    category: "cardio",
    difficulty: "Advanced",
    duration: "10-20 min",
    equipment: ["Assault Bike"],
    muscles: ["Full Body", "Cardiovascular", "Legs", "Arms", "Core"],
    instructions: [
      "Sit on bike, grip handles",
      "Pedal and push/pull handles simultaneously",
      "Maintain high intensity",
      "Rest between intervals",
      "Perform 4-8 intervals of 30-60 seconds"
    ],
    benefits: ["Full body workout", "High calorie burn", "Cardiovascular fitness", "Time efficient"]
  },
  // More Core Exercises
  {
    name: "Russian Twists",
    description: "Rotational core exercise for obliques and stability.",
    category: "core",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None", "Medicine Ball"],
    muscles: ["Obliques", "Core", "Hip Flexors"],
    instructions: [
      "Sit with knees bent, lean back slightly",
      "Rotate torso side to side",
      "Keep core engaged",
      "Add weight for difficulty",
      "Perform 3-4 sets of 20-30 reps"
    ],
    benefits: ["Strengthens obliques", "Improves rotation", "Core stability", "No equipment needed"]
  },
  {
    name: "Bicycle Crunches",
    description: "Dynamic core exercise targeting abs and obliques.",
    category: "core",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Rectus Abdominis", "Obliques", "Hip Flexors"],
    instructions: [
      "Lie on back, hands behind head",
      "Bring opposite elbow to knee",
      "Alternate sides in pedaling motion",
      "Keep lower back on ground",
      "Perform 3-4 sets of 20-30 reps"
    ],
    benefits: ["Targets abs and obliques", "No equipment", "Dynamic movement", "Beginners friendly"]
  },
  {
    name: "Hanging Leg Raises",
    description: "Advanced core exercise for lower abs.",
    category: "core",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["Pull-up Bar"],
    muscles: ["Lower Abs", "Hip Flexors", "Core"],
    instructions: [
      "Hang from pull-up bar",
      "Raise legs to 90 degrees",
      "Lower with control",
      "Keep body still",
      "Perform 3-4 sets of 10-15 reps"
    ],
    benefits: ["Targets lower abs", "Builds grip strength", "Advanced core work", "Full core engagement"]
  },
  {
    name: "Ab Wheel Rollout",
    description: "Advanced core exercise for full abdominal strength.",
    category: "core",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["Ab Wheel"],
    muscles: ["Rectus Abdominis", "Core", "Shoulders"],
    instructions: [
      "Start on knees, hold wheel",
      "Roll forward, extend body",
      "Keep core tight, don't arch back",
      "Roll back to start",
      "Perform 3-4 sets of 8-12 reps"
    ],
    benefits: ["Full core strength", "Improves stability", "Advanced exercise", "Builds anti-extension"]
  },
  {
    name: "Flutter Kicks",
    description: "Core exercise targeting lower abs and hip flexors.",
    category: "core",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Lower Abs", "Hip Flexors", "Core"],
    instructions: [
      "Lie on back, hands under glutes",
      "Lift legs slightly off ground",
      "Alternate kicking legs up and down",
      "Keep lower back pressed down",
      "Perform 3-4 sets of 30-60 seconds"
    ],
    benefits: ["Targets lower abs", "No equipment", "Beginners friendly", "Core endurance"]
  },
  {
    name: "Reverse Crunches",
    description: "Core exercise focusing on lower abdominal muscles.",
    category: "core",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Lower Abs", "Hip Flexors"],
    instructions: [
      "Lie on back, knees bent at 90 degrees",
      "Lift hips off ground, bring knees to chest",
      "Lower with control",
      "Keep upper body still",
      "Perform 3-4 sets of 15-20 reps"
    ],
    benefits: ["Targets lower abs", "No equipment", "Beginners friendly", "Controlled movement"]
  },
  {
    name: "V-Ups",
    description: "Advanced core exercise for full abdominal engagement.",
    category: "core",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Rectus Abdominis", "Hip Flexors", "Core"],
    instructions: [
      "Lie on back, arms and legs extended",
      "Simultaneously lift torso and legs",
      "Touch hands to feet at top",
      "Lower with control",
      "Perform 3-4 sets of 10-15 reps"
    ],
    benefits: ["Full core workout", "No equipment", "Advanced exercise", "Builds coordination"]
  },
  {
    name: "Hollow Body Hold",
    description: "Isometric core exercise for strength and stability.",
    category: "core",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Rectus Abdominis", "Core", "Hip Flexors"],
    instructions: [
      "Lie on back, arms and legs extended",
      "Lift shoulders and legs off ground",
      "Hold position, keep lower back pressed down",
      "Breathe normally",
      "Hold for 30-60 seconds, 3-4 sets"
    ],
    benefits: ["Isometric strength", "Core stability", "No equipment", "Builds endurance"]
  },
  {
    name: "Pallof Press",
    description: "Anti-rotation core exercise for stability.",
    category: "core",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Cable Machine", "Resistance Band"],
    muscles: ["Obliques", "Core", "Shoulders"],
    instructions: [
      "Stand perpendicular to cable/band",
      "Hold handle at chest, extend arms",
      "Resist rotation, keep core tight",
      "Return to chest",
      "Perform 3-4 sets of 10-15 reps per side"
    ],
    benefits: ["Anti-rotation strength", "Core stability", "Functional movement", "Injury prevention"]
  },
  // More Mobility Exercises
  {
    name: "Hip Circles",
    description: "Dynamic mobility exercise for hip joint.",
    category: "mobility",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["None"],
    muscles: ["Hip Flexors", "Hip Rotators", "Glutes"],
    instructions: [
      "Stand on one leg, lift other knee",
      "Circle hip in wide motion",
      "10 circles forward, 10 backward",
      "Switch legs",
      "Perform 2-3 sets per leg"
    ],
    benefits: ["Improves hip mobility", "Warm-up exercise", "No equipment", "Injury prevention"]
  },
  {
    name: "Shoulder Dislocations",
    description: "Mobility exercise for shoulder flexibility.",
    category: "mobility",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["Resistance Band", "Broomstick"],
    muscles: ["Shoulders", "Upper Back", "Rotator Cuff"],
    instructions: [
      "Hold band/stick wide grip",
      "Raise overhead, bring behind back",
      "Return to front",
      "Keep arms straight",
      "Perform 10-15 reps"
    ],
    benefits: ["Shoulder mobility", "Injury prevention", "Improves posture", "Warm-up"]
  },
  {
    name: "World's Greatest Stretch",
    description: "Full-body mobility exercise for multiple joints.",
    category: "mobility",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["None"],
    muscles: ["Hip Flexors", "Hamstrings", "Thoracic Spine", "Calves"],
    instructions: [
      "Start in lunge position",
      "Place opposite hand on ground",
      "Rotate torso, reach arm to ceiling",
      "Return and switch sides",
      "Perform 5-10 reps per side"
    ],
    benefits: ["Full body mobility", "Multiple joints", "Warm-up", "Injury prevention"]
  },
  {
    name: "90/90 Stretch",
    description: "Hip mobility exercise for internal and external rotation.",
    category: "mobility",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["Mat"],
    muscles: ["Hip Rotators", "Glutes", "Hip Flexors"],
    instructions: [
      "Sit with one leg at 90 degrees front, other at 90 degrees back",
      "Keep both knees at 90 degrees",
      "Lean forward for stretch",
      "Hold 30-60 seconds",
      "Switch sides"
    ],
    benefits: ["Hip mobility", "Improves rotation", "Injury prevention", "Flexibility"]
  },
  {
    name: "Pigeon Pose",
    description: "Deep hip and glute stretch.",
    category: "mobility",
    difficulty: "Intermediate",
    duration: "5-10 min",
    equipment: ["Mat"],
    muscles: ["Hip Flexors", "Glutes", "Piriformis"],
    instructions: [
      "Start in tabletop, bring one knee forward",
      "Extend back leg straight",
      "Square hips, lean forward",
      "Hold 30-60 seconds",
      "Switch sides"
    ],
    benefits: ["Deep hip stretch", "Glute flexibility", "Injury prevention", "Yoga-based"]
  },
  {
    name: "Couch Stretch",
    description: "Intense hip flexor and quadriceps stretch.",
    category: "mobility",
    difficulty: "Intermediate",
    duration: "5-10 min",
    equipment: ["Couch", "Wall"],
    muscles: ["Hip Flexors", "Quadriceps"],
    instructions: [
      "Place back foot on couch/wall",
      "Front leg in lunge position",
      "Push hips forward",
      "Hold 60-90 seconds",
      "Switch sides"
    ],
    benefits: ["Hip flexor flexibility", "Improves posture", "Injury prevention", "Deep stretch"]
  },
  {
    name: "Scorpion Stretch",
    description: "Advanced mobility exercise for hip flexors and thoracic spine.",
    category: "mobility",
    difficulty: "Advanced",
    duration: "5-10 min",
    equipment: ["Mat"],
    muscles: ["Hip Flexors", "Quadriceps", "Thoracic Spine"],
    instructions: [
      "Lie face down",
      "Reach back, grab foot",
      "Pull foot toward glute",
      "Lift opposite arm",
      "Hold 30-60 seconds, switch sides"
    ],
    benefits: ["Hip flexor stretch", "Thoracic mobility", "Advanced flexibility", "Full body"]
  },
  {
    name: "Thread the Needle",
    description: "Thoracic spine and shoulder mobility exercise.",
    category: "mobility",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["Mat"],
    muscles: ["Thoracic Spine", "Shoulders", "Upper Back"],
    instructions: [
      "Start on hands and knees",
      "Reach one arm under body, thread through",
      "Rotate torso, feel stretch",
      "Hold 20-30 seconds",
      "Switch sides"
    ],
    benefits: ["Thoracic mobility", "Shoulder flexibility", "Injury prevention", "Warm-up"]
  },
  {
    name: "Leg Swings",
    description: "Dynamic warm-up for hip mobility and activation.",
    category: "warmup",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["None", "Wall"],
    muscles: ["Hip Flexors", "Hamstrings", "Glutes"],
    instructions: [
      "Hold wall for support",
      "Swing leg forward and back",
      "10-15 swings forward/back",
      "Swing leg side to side",
      "10-15 swings side to side",
      "Switch legs"
    ],
    benefits: ["Hip mobility", "Warm-up", "Activation", "Injury prevention"]
  },
  {
    name: "Arm Circles",
    description: "Simple shoulder warm-up and mobility exercise.",
    category: "warmup",
    difficulty: "Beginner",
    duration: "5 min",
    equipment: ["None"],
    muscles: ["Shoulders", "Upper Back"],
    instructions: [
      "Stand with arms extended",
      "Circle arms forward 10-15 times",
      "Circle arms backward 10-15 times",
      "Increase circle size gradually",
      "Perform 2-3 sets"
    ],
    benefits: ["Shoulder warm-up", "Mobility", "No equipment", "Quick exercise"]
  },
  // More Strength Exercises
  {
    name: "Goblet Squat",
    description: "Beginner-friendly squat variation with front-loaded weight.",
    category: "strength",
    difficulty: "Beginner",
    duration: "15-20 min",
    equipment: ["Dumbbell", "Kettlebell"],
    muscles: ["Quadriceps", "Glutes", "Core"],
    instructions: [
      "Hold weight at chest",
      "Squat down, keep chest up",
      "Thighs parallel to floor",
      "Drive through heels to stand",
      "Perform 3-4 sets of 10-15 reps"
    ],
    benefits: ["Beginners friendly", "Core engagement", "Teaches squat pattern", "Full body"]
  },
  {
    name: "Bulgarian Split Squat",
    description: "Unilateral leg exercise for strength and balance.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Bench", "Dumbbells"],
    muscles: ["Quadriceps", "Glutes", "Core"],
    instructions: [
      "Place back foot on bench",
      "Front foot forward, lunge down",
      "Keep torso upright",
      "Drive through front heel",
      "Perform 3-4 sets of 8-12 reps per leg"
    ],
    benefits: ["Unilateral training", "Builds leg strength", "Improves balance", "Core stability"]
  },
  {
    name: "Front Squat",
    description: "Quadriceps-dominant squat variation with bar in front.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "20-30 min",
    equipment: ["Barbell", "Squat Rack"],
    muscles: ["Quadriceps", "Glutes", "Core", "Upper Back"],
    instructions: [
      "Rest bar on front deltoids",
      "Elbows up, keep torso upright",
      "Squat down, thighs parallel",
      "Drive through heels",
      "Perform 3-5 sets of 5-8 reps"
    ],
    benefits: ["Quadriceps focus", "Core strength", "Improves posture", "Athletic performance"]
  },
  {
    name: "Romanian Deadlift",
    description: "Hip-hinge exercise targeting hamstrings and glutes.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Barbell", "Dumbbells"],
    muscles: ["Hamstrings", "Glutes", "Erector Spinae", "Core"],
    instructions: [
      "Hold weight, slight knee bend",
      "Hinge at hips, push hips back",
      "Feel stretch in hamstrings",
      "Return to standing, squeeze glutes",
      "Keep back straight",
      "Perform 3-4 sets of 8-12 reps"
    ],
    benefits: ["Hamstring strength", "Hip mobility", "Posterior chain", "Core stability"]
  },
  {
    name: "Hip Thrust",
    description: "Glute-focused exercise for posterior chain development.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Barbell", "Bench"],
    muscles: ["Glutes", "Hamstrings", "Core"],
    instructions: [
      "Sit with upper back on bench",
      "Place bar across hips",
      "Drive hips up, squeeze glutes",
      "Lower with control",
      "Perform 3-4 sets of 10-15 reps"
    ],
    benefits: ["Glute development", "Posterior chain", "Hip extension", "Athletic performance"]
  },
  {
    name: "Walking Lunges",
    description: "Dynamic unilateral leg exercise for strength and coordination.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["None", "Dumbbells"],
    muscles: ["Quadriceps", "Glutes", "Hamstrings", "Core"],
    instructions: [
      "Step forward into lunge",
      "Lower back knee toward ground",
      "Push through front heel",
      "Step forward with back leg",
      "Continue walking",
      "Perform 3-4 sets of 20-30 steps"
    ],
    benefits: ["Unilateral training", "Coordination", "Leg strength", "Functional movement"]
  },
  {
    name: "Step-Ups",
    description: "Unilateral leg exercise using a box or bench.",
    category: "strength",
    difficulty: "Beginner",
    duration: "15-20 min",
    equipment: ["Bench", "Box", "Dumbbells"],
    muscles: ["Quadriceps", "Glutes", "Core"],
    instructions: [
      "Step onto box/bench with one foot",
      "Drive through heel to stand",
      "Step down with same leg",
      "Alternate legs",
      "Perform 3-4 sets of 10-15 reps per leg"
    ],
    benefits: ["Unilateral training", "Functional movement", "Leg strength", "Balance"]
  },
  {
    name: "Good Mornings",
    description: "Hip-hinge exercise for posterior chain and core.",
    category: "strength",
    difficulty: "Intermediate",
    duration: "15-20 min",
    equipment: ["Barbell"],
    muscles: ["Hamstrings", "Glutes", "Erector Spinae", "Core"],
    instructions: [
      "Bar on upper back",
      "Hinge at hips, keep back straight",
      "Feel stretch in hamstrings",
      "Return to standing",
      "Perform 3-4 sets of 10-12 reps"
    ],
    benefits: ["Posterior chain", "Hip mobility", "Core strength", "Injury prevention"]
  },
  {
    name: "Calf Raises",
    description: "Isolation exercise for calf development.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None", "Dumbbells", "Machine"],
    muscles: ["Calves", "Gastrocnemius", "Soleus"],
    instructions: [
      "Stand on balls of feet",
      "Rise up onto toes",
      "Squeeze calves at top",
      "Lower with control",
      "Perform 3-4 sets of 15-20 reps"
    ],
    benefits: ["Calf development", "Ankle stability", "No equipment option", "Quick exercise"]
  },
  {
    name: "Shrugs",
    description: "Isolation exercise for trapezius development.",
    category: "strength",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Dumbbells", "Barbell"],
    muscles: ["Traps", "Upper Back"],
    instructions: [
      "Hold weights at sides",
      "Shrug shoulders up",
      "Squeeze traps at top",
      "Lower with control",
      "Perform 3-4 sets of 12-15 reps"
    ],
    benefits: ["Trap development", "Upper back strength", "Posture improvement", "Neck support"]
  },
  // Sport-Specific Exercises
  {
    name: "Lateral Bounds",
    description: "Plyometric exercise for lateral power and agility.",
    category: "sport-specific",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Glutes", "Hip Abductors", "Core", "Calves"],
    instructions: [
      "Stand on one leg",
      "Jump laterally to other leg",
      "Land softly, immediately bound other direction",
      "Keep core engaged",
      "Perform 3-4 sets of 10-15 bounds per side"
    ],
    benefits: ["Lateral power", "Agility", "Sport-specific", "Injury prevention"]
  },
  {
    name: "Agility Ladder Drills",
    description: "Coordination and agility exercise for sports performance.",
    category: "sport-specific",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Agility Ladder"],
    muscles: ["Legs", "Core", "Coordination"],
    instructions: [
      "Step through ladder with various patterns",
      "Two feet in each square",
      "Lateral movements",
      "High knees through ladder",
      "Perform 3-5 different patterns"
    ],
    benefits: ["Agility", "Coordination", "Foot speed", "Sport performance"]
  },
  {
    name: "Cone Drills",
    description: "Agility and change of direction exercise.",
    category: "sport-specific",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["Cones"],
    muscles: ["Legs", "Core", "Cardiovascular"],
    instructions: [
      "Set up cones in pattern",
      "Sprint to cone, change direction",
      "Various patterns: 5-10-5, T-test, etc.",
      "Rest between sets",
      "Perform 4-6 sets"
    ],
    benefits: ["Agility", "Change of direction", "Sport-specific", "Cardiovascular fitness"]
  },
  {
    name: "Plyometric Push-Ups",
    description: "Explosive upper body exercise for power.",
    category: "sport-specific",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Chest", "Triceps", "Shoulders", "Core"],
    instructions: [
      "Start in push-up position",
      "Lower with control",
      "Explode up, hands leave ground",
      "Land softly, immediately repeat",
      "Perform 3-4 sets of 5-10 reps"
    ],
    benefits: ["Upper body power", "Explosive strength", "Athletic performance", "No equipment"]
  },
  {
    name: "Single-Leg Hops",
    description: "Plyometric exercise for single-leg power and stability.",
    category: "sport-specific",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Quadriceps", "Calves", "Core", "Ankle Stabilizers"],
    instructions: [
      "Stand on one leg",
      "Hop forward, land on same leg",
      "Immediately hop again",
      "Keep core engaged",
      "Perform 3-4 sets of 10-15 hops per leg"
    ],
    benefits: ["Single-leg power", "Balance", "Ankle stability", "Sport-specific"]
  },
  {
    name: "Depth Jumps",
    description: "Advanced plyometric exercise for reactive strength.",
    category: "sport-specific",
    difficulty: "Advanced",
    duration: "10-15 min",
    equipment: ["Box"],
    muscles: ["Quadriceps", "Glutes", "Calves", "Core"],
    instructions: [
      "Step off box",
      "Land and immediately jump up",
      "Minimize ground contact time",
      "Land softly",
      "Perform 3-4 sets of 5-8 reps"
    ],
    benefits: ["Reactive strength", "Plyometric power", "Athletic performance", "Advanced training"]
  },
  {
    name: "Bear Crawl",
    description: "Full-body coordination and strength exercise.",
    category: "sport-specific",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Full Body", "Core", "Shoulders", "Legs"],
    instructions: [
      "Start on hands and feet",
      "Crawl forward, opposite hand/foot",
      "Keep hips level, core engaged",
      "Move 10-20 meters",
      "Perform 3-4 sets"
    ],
    benefits: ["Full body workout", "Coordination", "Core strength", "Functional movement"]
  },
  {
    name: "Crab Walk",
    description: "Full-body exercise for posterior chain and coordination.",
    category: "sport-specific",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Glutes", "Hamstrings", "Shoulders", "Core"],
    instructions: [
      "Sit with hands behind, fingers forward",
      "Lift hips, walk on hands and feet",
      "Move forward or backward",
      "Keep core engaged",
      "Perform 3-4 sets of 10-20 meters"
    ],
    benefits: ["Posterior chain", "Coordination", "Full body", "No equipment"]
  },
  {
    name: "Broad Jumps",
    description: "Horizontal plyometric exercise for power and distance.",
    category: "sport-specific",
    difficulty: "Intermediate",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Quadriceps", "Glutes", "Calves", "Core"],
    instructions: [
      "Start in squat position",
      "Jump forward as far as possible",
      "Land softly, absorb impact",
      "Rest between jumps",
      "Perform 3-4 sets of 5-8 jumps"
    ],
    benefits: ["Horizontal power", "Athletic performance", "Leg strength", "Plyometric training"]
  },
  {
    name: "Lateral Shuffles",
    description: "Agility exercise for lateral movement and speed.",
    category: "sport-specific",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None", "Cones"],
    muscles: ["Hip Abductors", "Glutes", "Core", "Cardiovascular"],
    instructions: [
      "Start in athletic stance",
      "Shuffle laterally, stay low",
      "Don't cross feet",
      "Move 10-20 meters each direction",
      "Perform 4-6 sets"
    ],
    benefits: ["Lateral agility", "Sport-specific", "Cardiovascular", "Coordination"]
  },
  // More Rehab Exercises
  {
    name: "Clamshells",
    description: "Hip strengthening exercise for glute medius.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Mat", "Resistance Band"],
    muscles: ["Glute Medius", "Hip Abductors"],
    instructions: [
      "Lie on side, knees bent at 90 degrees",
      "Keep feet together, lift top knee",
      "Don't roll backward",
      "Lower with control",
      "Perform 3-4 sets of 15-20 reps per side"
    ],
    benefits: ["Hip strength", "Injury prevention", "Glute activation", "IT band health"]
  },
  {
    name: "Fire Hydrants",
    description: "Hip mobility and glute activation exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Mat"],
    muscles: ["Glute Medius", "Hip Abductors", "Core"],
    instructions: [
      "Start on hands and knees",
      "Lift one leg to side, knee bent",
      "Keep core engaged",
      "Lower with control",
      "Perform 3-4 sets of 15-20 reps per side"
    ],
    benefits: ["Hip mobility", "Glute activation", "Injury prevention", "Core stability"]
  },
  {
    name: "Band Pull-Aparts",
    description: "Shoulder rehabilitation and posture exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Resistance Band"],
    muscles: ["Rear Delts", "Rhomboids", "Middle Traps"],
    instructions: [
      "Hold band with arms extended",
      "Pull band apart, squeeze shoulder blades",
      "Keep arms straight",
      "Return with control",
      "Perform 3-4 sets of 15-20 reps"
    ],
    benefits: ["Shoulder health", "Posture improvement", "Injury prevention", "Upper back strength"]
  },
  {
    name: "External Rotation",
    description: "Rotator cuff strengthening exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Resistance Band", "Dumbbell"],
    muscles: ["Rotator Cuff", "Rear Delts"],
    instructions: [
      "Elbow at 90 degrees, arm at side",
      "Rotate arm outward",
      "Squeeze rear delt",
      "Return with control",
      "Perform 3-4 sets of 12-15 reps per side"
    ],
    benefits: ["Rotator cuff strength", "Shoulder health", "Injury prevention", "Stability"]
  },
  {
    name: "Wall Angels",
    description: "Posture and shoulder mobility exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Wall"],
    muscles: ["Upper Back", "Shoulders", "Posture Muscles"],
    instructions: [
      "Stand against wall, arms in W position",
      "Slide arms up to Y position",
      "Keep contact with wall",
      "Return to W position",
      "Perform 3-4 sets of 10-15 reps"
    ],
    benefits: ["Posture improvement", "Shoulder mobility", "Upper back strength", "Injury prevention"]
  },
  {
    name: "Ankle Circles",
    description: "Ankle mobility and rehabilitation exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["None"],
    muscles: ["Ankle", "Calves"],
    instructions: [
      "Sit or stand, lift one foot",
      "Circle ankle 10 times clockwise",
      "Circle 10 times counterclockwise",
      "Switch feet",
      "Perform 2-3 sets per foot"
    ],
    benefits: ["Ankle mobility", "Injury prevention", "Rehabilitation", "Warm-up"]
  },
  {
    name: "Heel Raises",
    description: "Calf strengthening and ankle stability exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["None"],
    muscles: ["Calves", "Ankle Stabilizers"],
    instructions: [
      "Stand on one leg",
      "Rise up onto toe",
      "Lower with control",
      "Perform on both legs",
      "3-4 sets of 15-20 reps per leg"
    ],
    benefits: ["Calf strength", "Ankle stability", "Balance", "Injury prevention"]
  },
  {
    name: "Toe Taps",
    description: "Ankle and calf mobility exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "5-10 min",
    equipment: ["None"],
    muscles: ["Calves", "Ankle", "Shins"],
    instructions: [
      "Stand on one leg",
      "Tap other toe forward, then back",
      "Keep standing leg stable",
      "Alternate directions",
      "Perform 20-30 taps per leg"
    ],
    benefits: ["Ankle mobility", "Balance", "Coordination", "Warm-up"]
  },
  {
    name: "Quadruped Hip Circles",
    description: "Hip mobility and glute activation exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Mat"],
    muscles: ["Hip", "Glutes", "Core"],
    instructions: [
      "Start on hands and knees",
      "Lift one knee, circle hip",
      "10 circles each direction",
      "Switch legs",
      "Perform 2-3 sets per leg"
    ],
    benefits: ["Hip mobility", "Glute activation", "Core stability", "Injury prevention"]
  },
  {
    name: "Prone Y-T-W",
    description: "Upper back and shoulder rehabilitation exercise.",
    category: "rehab",
    difficulty: "Beginner",
    duration: "10-15 min",
    equipment: ["Mat"],
    muscles: ["Upper Back", "Rear Delts", "Rhomboids"],
    instructions: [
      "Lie face down, arms extended",
      "Form Y shape, lift arms",
      "Form T shape, lift arms",
      "Form W shape, lift arms",
      "Perform 10-15 reps of each"
    ],
    benefits: ["Upper back strength", "Shoulder health", "Posture", "Injury prevention"]
  }
]

export async function POST(req: NextRequest) {
  try {
    // Public endpoint - no authentication required for seeding
    // Check if exercises already exist
    const existingResult = await docClient.send(
      new ScanCommand({
        TableName: EXERCISE_CATALOG_TABLE,
        Limit: 1,
      })
    )

    if (existingResult.Items && existingResult.Items.length > 0) {
      return NextResponse.json(
        { 
          message: "Exercises already seeded.", 
          count: existingResult.Items.length,
          note: "Clear the table first if you want to re-seed."
        },
        { status: 200 }
      )
    }

    // Seed exercises
    const items = initialExercises.map((exercise) => ({
      exercise_id: uuidv4(),
      name: exercise.name,
      description: exercise.description,
      category: exercise.category,
      difficulty: exercise.difficulty,
      duration: exercise.duration,
      equipment: exercise.equipment,
      muscles: exercise.muscles,
      instructions: exercise.instructions,
      benefits: exercise.benefits,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Batch write (DynamoDB allows up to 25 items per batch)
    const batches = []
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25))
    }

    for (const batch of batches) {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [EXERCISE_CATALOG_TABLE]: batch.map((item) => ({
              PutRequest: {
                Item: item,
              },
            })),
          },
        })
      )
    }

    return NextResponse.json(
      { message: `Successfully seeded ${items.length} exercises` },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error seeding exercises:", error)
    return NextResponse.json(
      { error: error.message || "Failed to seed exercises" },
      { status: 500 }
    )
  }
}

