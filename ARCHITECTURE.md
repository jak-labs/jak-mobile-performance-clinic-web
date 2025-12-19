# Mobile Performance Clinic - System Architecture

## Overview
This document describes the complete architecture of the Mobile Performance Clinic application, including video streaming, pose detection, metrics collection, AI analysis, and chat functionality.

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT-SIDE (Browser)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                        │
│  │  Coach/Client    │         │   Participant    │                        │
│  │   (React App)    │         │   (React App)    │                        │
│  └────────┬─────────┘         └────────┬─────────┘                        │
│           │                            │                                   │
│           │  LiveKit Room Connection   │                                   │
│           │  (WebRTC via LiveKit SDK)  │                                   │
│           │                            │                                   │
│  ┌────────▼────────────────────────────▼─────────┐                        │
│  │         LiveKit Room Context                   │                        │
│  │  - Video/Audio Tracks                          │                        │
│  │  - Participant Management                      │                        │
│  │  - Data Channel (Chat Messages)                │                        │
│  └────────┬────────────────────────────┬─────────┘                        │
│           │                            │                                   │
│           │                            │                                   │
│  ┌────────▼────────────────────────────▼─────────┐                        │
│  │         Video Element (HTMLVideoElement)       │                        │
│  │  - Captures video frames from LiveKit tracks    │                        │
│  │  - Hidden video elements per participant        │                        │
│  └────────┬───────────────────────────────────────┘                        │
│           │                                                                 │
│           │ Video Frames (every 3 seconds)                                 │
│           │                                                                 │
│  ┌────────▼───────────────────────────────────────┐                        │
│  │     YOLOv8-Pose Detection                      │                        │
│  │  - Model: yolov8n-pose.onnx (~13MB)           │                        │
│  │  - Runtime: ONNX Runtime Web (WASM)             │                        │
│  │  - Input: 640x640 RGB image                     │                        │
│  │  - Output: 17 keypoints (COCO format)          │                        │
│  │  - Frequency: Every 3 seconds per participant  │                        │
│  └────────┬───────────────────────────────────────┘                        │
│           │                                                                 │
│           │ Pose Keypoints (17 points: nose, eyes, shoulders, etc.)       │
│           │                                                                 │
│  ┌────────▼───────────────────────────────────────┐                        │
│  │     Biomechanical Analysis                      │                        │
│  │  - calculateBiomechanicalAngles()               │                        │
│  │    • Knee angles (left/right)                   │                        │
│  │    • Hip angles (left/right)                    │                        │
│  │    • Ankle angles (left/right)                  │                        │
│  │    • Shoulder angles (left/right)               │                        │
│  │    • Elbow angles (left/right)                  │                        │
│  │    • Spine lean                                 │                        │
│  │    • Neck flexion                               │                        │
│  │                                                 │                        │
│  │  - calculateBiomechanicalMetrics()               │                        │
│  │    • Balance Score (0-100)                      │                        │
│  │      - Based on center of mass deviation        │                        │
│  │    • Symmetry Score (0-100)                     │                        │
│  │      - Left vs right side comparison            │                        │
│  │    • Postural Efficiency (0-100)                │                        │
│  │      - Average of balance + symmetry            │                        │
│  │    • Center of Mass (x, y coordinates)         │                        │
│  └────────┬───────────────────────────────────────┘                        │
│           │                                                                 │
│           │ Metrics + Pose Data Buffer                                      │
│           │ (Stored in memory, analyzed every 5 seconds)                    │
│           │                                                                 │
│  ┌────────▼───────────────────────────────────────┐                        │
│  │     Metrics Storage (Client-side)               │                        │
│  │  - Pose data buffer (last 10 poses)            │                        │
│  │  - Metrics calculated every 5 seconds           │                        │
│  └────────┬───────────────────────────────────────┘                        │
│           │                                                                 │
│           │ POST /api/ai-insights/save-metric                               │
│           │ (Every 5 seconds when metrics available)                       │
│           │                                                                 │
└───────────┼───────────────────────────────────────────────────────────────┘
            │
            │ HTTPS
            │
┌───────────▼───────────────────────────────────────────────────────────────┐
│                        SERVER-SIDE (Next.js API)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  POST /api/ai-insights/save-metric                          │          │
│  │  - Receives: participant_id, metrics, pose_data             │          │
│  │  - Stores in: DynamoDB (jak-ai-metrics table)              │          │
│  │  - Key: subject_id (PK), timestamp (SK)                    │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  POST /api/ai-insights/generate-from-metrics                │          │
│  │  - Fetches latest metrics from DynamoDB                     │          │
│  │  - Aggregates metrics per participant                       │          │
│  │  - Calls OpenAI GPT-4o for analysis                         │          │
│  │  - Stores insights in DynamoDB (jak-ai-insights table)      │          │
│  │  - Frequency: Every 30 seconds (auto-triggered)             │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  POST /api/ai/analyze-movement                               │          │
│  │  - Receives: pose_data (array of poses with keypoints)      │          │
│  │  - Calculates: angles, metrics, movement patterns           │          │
│  │  - Calls OpenAI GPT-4o with structured prompt               │          │
│  │  - Returns: JSON analysis (posture, movement, recommendations)│          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  POST /api/chat/send                                         │          │
│  │  - Receives: sessionId, participantId, message               │          │
│  │  - Stores in: DynamoDB (jak-chat-messages table)           │          │
│  │  - Also publishes via LiveKit data channel                   │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  POST /api/livekit/start-recording                           │          │
│  │  - Uses LiveKit EgressClient                                 │          │
│  │  - Records room composite to S3                              │          │
│  │  - Format: MP4                                               │          │
│  │  - Destination: jak-mpc-recorded-sessions-subjects-only     │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  POST /api/subject-only-sessions/upload-and-analyze         │          │
│  │  - Triggered after recording stops                           │          │
│  │  - Downloads video from S3                                    │          │
│  │  - Analyzes with OpenAI GPT-4o (vision)                      │          │
│  │  - Stores report in DynamoDB                                 │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
└───────────┬───────────────────────────────────────────────────────────────┘
            │
            │ API Calls
            │
┌───────────▼───────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  LiveKit Cloud                                               │          │
│  │  - WebRTC SFU (Selective Forwarding Unit)                   │          │
│  │  - Room management                                           │          │
│  │  - Egress (recording) service                                │          │
│  │  - Data channel for real-time chat                           │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  AWS DynamoDB                                                │          │
│  │  Tables:                                                     │          │
│  │  - jak-ai-metrics (subject_id PK, timestamp SK)             │          │
│  │  - jak-ai-insights (session_id PK, insight_id SK)            │          │
│  │  - jak-chat-messages (session_id PK, timestamp SK)           │          │
│  │  - jak-subject-only-sessions (subject_id PK, session_id SK) │          │
│  │  - jak-subject-only-sessions-ai-summary                     │          │
│  │    (subject_id PK, session_id SK)                            │          │
│  │  - jak-prescribed-exercises (subject_id PK, exercise_id SK) │          │
│  │  - jak-exercise-catalog (exercise_id PK)                     │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  AWS S3                                                      │          │
│  │  Bucket: jak-mpc-recorded-sessions-subjects-only             │          │
│  │  - Stores MP4 recordings from LiveKit Egress                 │          │
│  │  - Path: subject-only-sessions/{exerciseId}/{timestamp}.mp4  │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  OpenAI API                                                   │          │
│  │  Model: GPT-4o                                               │          │
│  │  Endpoints:                                                  │          │
│  │  - /v1/chat/completions (text analysis)                     │          │
│  │  - /v1/chat/completions (vision - video analysis)           │          │
│  │  Input:                                                      │          │
│  │  - Pose keypoints (17 points)                                │          │
│  │  - Biomechanical angles                                      │          │
│  │  - Metrics (balance, symmetry, postural)                     │          │
│  │  Output:                                                     │          │
│  │  - Movement analysis JSON                                    │          │
│  │  - Performance insights                                      │          │
│  │  - Recommendations                                           │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

```

---

## Data Flow: Real-Time Session

### 1. Session Start
```
Participant Joins
    ↓
LiveKit Room Connection (WebRTC)
    ↓
Video Tracks Published
    ↓
Welcome Message Sent (immediately via ChatPanel)
```

### 2. Pose Detection Loop (Every 3 seconds)
```
Video Frame Captured
    ↓
YOLOv8-Pose Detection (ONNX Runtime Web)
    ↓
17 Keypoints Extracted (COCO format)
    ↓
Biomechanical Analysis:
  - Angles calculated (knee, hip, ankle, shoulder, elbow, spine, neck)
  - Metrics calculated (balance, symmetry, postural efficiency)
    ↓
Pose Data Buffered (last 10 poses stored)
```

### 3. Metrics Analysis (Every 5 seconds)
```
Pose Buffer Analyzed
    ↓
Movement Patterns Detected
    ↓
Metrics Calculated:
  - Balance Score (center of mass deviation)
  - Symmetry Score (left vs right comparison)
  - Postural Efficiency (average of balance + symmetry)
    ↓
POST /api/ai-insights/save-metric
    ↓
Stored in DynamoDB (jak-ai-metrics)
```

### 4. AI Analysis (Every 30 seconds)
```
Latest Metrics Fetched from DynamoDB
    ↓
POST /api/ai-insights/generate-from-metrics
    ↓
OpenAI GPT-4o Analysis:
  - Input: Metrics + pose data
  - System Prompt: Expert movement analyst
  - Output: JSON insights
    ↓
Insights Stored in DynamoDB (jak-ai-insights)
    ↓
POST /api/chat/send (AI Coach message with metrics)
    ↓
Chat Message Displayed (via LiveKit data channel)
```

### 5. Chat Flow
```
User Types Message
    ↓
POST /api/chat/send
    ↓
Stored in DynamoDB (jak-chat-messages)
    ↓
Published via LiveKit Data Channel
    ↓
Real-time Delivery to All Participants
```

### 6. Recording Flow (Subject-Only Sessions)
```
User Clicks "RECORD"
    ↓
POST /api/livekit/start-recording
    ↓
LiveKit Egress Starts
    ↓
Video Recorded to S3 (MP4 format)
    ↓
User Clicks "STOP"
    ↓
POST /api/livekit/stop-recording
    ↓
POST /api/subject-only-sessions/upload-and-analyze
    ↓
Video Downloaded from S3
    ↓
OpenAI GPT-4o Vision Analysis
    ↓
Report Stored in DynamoDB
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, TypeScript, Tailwind CSS, Radix UI
- **Video**: LiveKit Client SDK (`livekit-client`, `@livekit/components-react`)
- **Pose Detection**: 
  - YOLOv8-Pose (ONNX format)
  - ONNX Runtime Web (WASM backend)
- **State Management**: React Hooks (useState, useEffect, useRef)

### Backend
- **Runtime**: Next.js API Routes (Node.js)
- **Authentication**: NextAuth.js with AWS Cognito
- **Database**: AWS DynamoDB
- **Storage**: AWS S3
- **Video Streaming**: LiveKit Cloud
- **AI**: OpenAI GPT-4o

### Pose Detection Pipeline
1. **Model**: YOLOv8n-Pose (nano version, ~13MB)
2. **Format**: ONNX (optimized for web)
3. **Runtime**: ONNX Runtime Web (WASM)
4. **Input**: 640x640 RGB image
5. **Output**: 17 keypoints (COCO format)
6. **Frequency**: Every 3 seconds per participant

### Metrics Calculation
- **Balance Score**: Based on center of mass deviation from center (0-100)
- **Symmetry Score**: Left vs right side comparison (0-100)
- **Postural Efficiency**: Average of balance + symmetry (0-100)
- **Angles**: Knee, hip, ankle, shoulder, elbow, spine lean, neck flexion

### AI Analysis
- **Model**: GPT-4o
- **Input Format**: JSON with pose keypoints, angles, and metrics
- **Output Format**: Structured JSON with:
  - Posture metrics
  - Movement quality
  - Movement patterns
  - Performance interpretation
  - Risk assessment
  - Targeted recommendations

---

## Key Components

### Client-Side Components
1. **LiveKitVideoSession** (`components/livekit-video-session.tsx`)
   - Main video session component
   - Manages room connection
   - Renders participant tiles
   - Handles layout modes (grid, spotlight, one-on-one)

2. **AIInsightsPanel** (`components/ai-insights-panel.tsx`)
   - Pose detection setup
   - Metrics collection
   - AI insights display
   - Only visible to coaches

3. **ChatPanel** (`components/chat-panel.tsx`)
   - Chat UI
   - Welcome message sending
   - Real-time message display
   - LiveKit data channel listener

4. **CustomVideoControls** (`components/custom-video-controls.tsx`)
   - Video control bar
   - Mic/camera toggles
   - Leave button
   - Record button (for subject-only sessions)

### API Routes
1. **`/api/livekit/token`** - Generate LiveKit access tokens
2. **`/api/livekit/create-room`** - Create LiveKit rooms
3. **`/api/livekit/start-recording`** - Start video recording (Egress)
4. **`/api/livekit/stop-recording`** - Stop video recording
5. **`/api/ai-insights/save-metric`** - Save metrics to DynamoDB
6. **`/api/ai-insights/generate-from-metrics`** - Generate AI insights
7. **`/api/ai/analyze-movement`** - Analyze movement with GPT-4o
8. **`/api/chat/send`** - Send chat messages
9. **`/api/chat/messages/[sessionId]`** - Fetch chat messages
10. **`/api/subject-only-sessions/upload-and-analyze`** - Analyze recorded videos

### Libraries
- **`lib/pose-detection.ts`** - Pose detection utilities
  - `createPoseDetector()` - Initialize YOLOv8-Pose
  - `estimatePoses()` - Detect poses from video
  - `calculateBiomechanicalAngles()` - Calculate joint angles
  - `calculateBiomechanicalMetrics()` - Calculate scores

---

## Timing & Intervals

| Action | Frequency | Trigger |
|--------|-----------|---------|
| Welcome Message | Once | Immediately when participant joins |
| Video Frame Capture | Every 3 seconds | Continuous loop |
| Pose Detection | Every 3 seconds | Per video frame |
| Metrics Calculation | Every 5 seconds | After pose detection |
| Metrics Save to DB | Every 5 seconds | When metrics available |
| AI Insights Generation | Every 30 seconds | Auto-triggered |
| Chat Metrics Post | Every 30 seconds | When metrics available |
| Chat Message Polling | Every 2 seconds | Continuous |

---

## Data Structures

### Pose Keypoint
```typescript
{
  x: number,        // Normalized 0-1
  y: number,        // Normalized 0-1
  score: number,   // Confidence 0-1
  name: string     // Keypoint name (e.g., "nose", "left_shoulder")
}
```

### Biomechanical Metrics
```typescript
{
  balanceScore: number,        // 0-100
  symmetryScore: number,       // 0-100
  posturalEfficiency: number, // 0-100
  centerOfMass: { x: number, y: number }
}
```

### AI Insight
```typescript
{
  postureMetrics: {
    spineLean: string,
    neckFlexion: string,
    shoulderAlignment: string,
    pelvicSway: string
  },
  movementQuality: string,
  movementPatterns: string[],
  performanceInterpretation: string,
  performanceImpact: string[],
  riskLevel: "Low" | "Moderate" | "High",
  targetedRecommendations: string[]
}
```

---

## Security & Authentication

- **Authentication**: NextAuth.js with AWS Cognito
- **API Routes**: Protected by session validation
- **LiveKit Tokens**: Server-side generation with room permissions
- **AWS Credentials**: Environment variables (JAK_AWS_* prefix for Netlify)

---

## Deployment

- **Platform**: Netlify (Next.js)
- **Environment Variables**: 
  - `JAK_AWS_*` prefix for AWS credentials
  - `LIVEKIT_*` for LiveKit configuration
  - `OPENAI_API_KEY` for AI analysis
  - `NEXT_PUBLIC_LIVEKIT_URL` for client connection

---

## Performance Considerations

1. **Pose Detection**: Runs every 3 seconds (not every frame) to reduce CPU load
2. **ONNX Runtime**: Uses WASM backend (more stable than WebGL)
3. **Metrics Buffering**: Only last 10 poses stored in memory
4. **Database Writes**: Batched every 5 seconds
5. **AI Analysis**: Cached insights, regenerated every 30 seconds
6. **Video Recording**: Only for subject-only sessions (not coach sessions)

---

## Future Enhancements

- Real-time pose overlay on video
- Multi-participant pose tracking
- Advanced biomechanical analysis
- Custom exercise templates
- Historical trend analysis
- Export reports as PDF

