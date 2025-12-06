# LLM Analysis Payload Structure

## Overview
The system sends **raw video frames** (JPEG images as base64) directly to **GPT-4o Vision API** for movement analysis. It does **NOT** use CV pose estimation libraries - the LLM performs the pose/movement analysis itself.

## Data Collection Process

### Frame Collection
1. **Source**: Live video streams from LiveKit participants
2. **Frequency**: Every 3 seconds
3. **Buffer Size**: Maximum 10 frames (30 seconds total)
4. **Format**: Canvas-captured video frames converted to JPEG base64
5. **Quality**: JPEG quality 0.6 (to manage token usage)

### Frame Structure (in memory)
```javascript
{
  imageBase64: string,      // Base64-encoded JPEG image (without data:image/jpeg;base64, prefix)
  timestamp: number,          // Seconds (0, 3, 6, 9, ... up to 27)
  sequenceNumber: number      // Frame index (0-9)
}
```

## Request Payload to LLM

### Endpoint
`POST /api/ai/analyze-movement`

### Request Body Structure

#### Multi-Frame Analysis (Current Implementation)
```json
{
  "frames": [
    {
      "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",  // Base64 JPEG (no prefix)
      "timestamp": 0,                                // 0, 3, 6, 9, 12, 15, 18, 21, 24, 27
      "sequenceNumber": 0                             // 0-9
    },
    {
      "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "timestamp": 3,
      "sequenceNumber": 1
    },
    // ... up to 10 frames
  ],
  "participantName": "James Doe",
  "participantId": "participant-123"
}
```

#### Single-Frame Analysis (Legacy)
```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "participantName": "James Doe",
  "participantId": "participant-123"
}
```

## OpenAI API Request Structure

### Messages Array
```javascript
[
  {
    role: "system",
    content: `You are an expert movement analyst and sports performance coach...
    
    Format your response as JSON with the following structure:
    {
      "postureMetrics": {
        "spineLean": string,
        "neckFlexion": string,
        "shoulderAlignment": string,
        "pelvicSway": string,
        "additionalMetrics": array of strings
      },
      "movementQuality": string,
      "movementPatterns": array of strings,
      "movementConsistency": number (0-100),
      "dynamicStability": number (0-100),
      "performanceInterpretation": string,
      "performanceImpact": array of strings,
      "balanceScore": number (0-100),
      "symmetryScore": number (0-100),
      "posturalEfficiency": number (0-100),
      "riskLevel": string ("Low" | "Moderate" | "High"),
      "riskDescription": string,
      "targetedRecommendations": array of strings
    }`
  },
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "Analyze this movement sequence for participant: James Doe.\n\nThese 10 frames were captured over 30 seconds (every 3 seconds). Analyze the ACTUAL MOVEMENT patterns, not just static posture.\n\nFrame sequence: Frame 1 at 0s, Frame 2 at 3s, Frame 3 at 6s, ..."
      },
      {
        type: "image_url",
        image_url: {
          url: "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        }
      },
      {
        type: "image_url",
        image_url: {
          url: "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        }
      },
      // ... up to 10 images
    ]
  }
]
```

### API Configuration
```javascript
{
  model: "gpt-4o",
  max_tokens: 2000,
  response_format: { type: "json_object" }
}
```

## Response Structure

### Expected LLM Response
```json
{
  "postureMetrics": {
    "spineLean": "5° forward (close to ideal)",
    "neckFlexion": "10° forward",
    "shoulderAlignment": "Benign asymmetry noted",
    "pelvicSway": "Minimal observed",
    "additionalMetrics": [
      "Hand support on face indicating fatigue or thought process",
      "Releasing hand support increases range of motion"
    ]
  },
  "movementQuality": "Controlled with minor adjustments",
  "movementPatterns": [
    "Head tilting forward slightly",
    "Right hand supporting head",
    "Left hand holding phone steady"
  ],
  "movementConsistency": 90,
  "dynamicStability": 85,
  "performanceInterpretation": "The movement patterns show...",
  "performanceImpact": [
    "Reduces rotational power output",
    "Increases low-back fatigue risk"
  ],
  "balanceScore": 80,
  "symmetryScore": 85,
  "posturalEfficiency": 75,
  "riskLevel": "Low",
  "riskDescription": "Low risk of injury with current movement patterns",
  "targetedRecommendations": [
    "Chin tucks – 3×10 reps",
    "Scapular retractions – 2×12 reps"
  ]
}
```

## Key Points

1. **No CV Pose Estimation**: The system does NOT use pose estimation libraries (like MediaPipe, OpenPose, etc.). It sends raw video frames directly to GPT-4o Vision.

2. **Vision-Based Analysis**: GPT-4o Vision performs the pose/movement analysis using its built-in vision capabilities.

3. **Multi-Frame Analysis**: For movement metrics, the system collects 10 frames over 30 seconds and sends them all to the LLM for temporal analysis.

4. **Base64 Encoding**: Images are converted to base64-encoded JPEG strings for transmission.

5. **Token Management**: JPEG quality is set to 0.6 to reduce token usage while maintaining sufficient image quality for analysis.

6. **JSON Response Format**: The LLM is instructed to return structured JSON with specific fields for metrics, scores, and recommendations.

## Example Complete Request (Simplified)

```javascript
// Frontend sends:
POST /api/ai/analyze-movement
{
  "frames": [
    { "imageBase64": "...", "timestamp": 0, "sequenceNumber": 0 },
    { "imageBase64": "...", "timestamp": 3, "sequenceNumber": 1 },
    // ... 8 more frames
  ],
  "participantName": "James Doe",
  "participantId": "participant-123"
}

// Backend sends to OpenAI:
POST https://api.openai.com/v1/chat/completions
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert movement analyst..."
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Analyze this movement sequence..." },
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } },
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } },
        // ... more images
      ]
    }
  ],
  "max_tokens": 2000,
  "response_format": { "type": "json_object" }
}
```


