import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { frames, imageBase64, participantName, exerciseName, participantId } = body;

    // Support both single frame (legacy) and multiple frames (new)
    const isMultiFrame = Array.isArray(frames) && frames.length > 0;
    const singleFrame = imageBase64;

    if (!isMultiFrame && !singleFrame) {
      return NextResponse.json(
        { error: 'Image data or frames array is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build content array for OpenAI API
    const content: any[] = [
      {
        type: 'text',
        text: isMultiFrame
          ? `Analyze this movement sequence${exerciseName ? ` for the exercise: ${exerciseName}` : ''}${participantName ? ` for participant: ${participantName}` : ''}. 

These ${frames.length} frames were captured over 30 seconds (every 3 seconds). Analyze the ACTUAL MOVEMENT patterns, not just static posture.

Provide a comprehensive movement analysis that includes:
1. Movement quality assessment (smoothness, control, efficiency)
2. Movement patterns observed across the sequence (compensations, asymmetries, deviations)
3. Range of motion analysis (how movement changes over time)
4. Movement consistency (how consistent the movement is across frames)
5. Dynamic stability and balance throughout the movement
6. Posture metrics with specific measurements/observations (averaged across frames)
7. Performance interpretation explaining what these movement patterns mean for athletic performance
8. Performance impact - specific ways movement quality affects performance
9. Scores (balance, symmetry, postural efficiency, movement consistency, dynamic stability)
10. Risk level assessment based on movement quality
11. Targeted recommendations with specific exercises and reps

Focus on:
- ACTUAL MOVEMENT ANALYSIS (how the body moves, not just static positions)
- Movement quality and patterns across the 30-second sequence
- How movement changes or remains consistent over time
- Dynamic compensations and asymmetries
- Actionable insights that help coaches understand movement performance implications.

Frame sequence: ${frames.map((f: any, idx: number) => `Frame ${idx + 1} at ${f.timestamp}s`).join(', ')}`
          : `Analyze this movement frame${exerciseName ? ` for the exercise: ${exerciseName}` : ''}${participantName ? ` for participant: ${participantName}` : ''}. 

Provide a comprehensive movement analysis that includes:
1. Posture metrics with specific measurements/observations
2. Performance interpretation explaining what this means for athletic performance
3. Performance impact - specific ways this affects performance
4. Scores (balance, symmetry, postural efficiency)
5. Risk level assessment
6. Targeted recommendations with specific exercises and reps

Focus on actionable insights that help coaches understand the performance implications.`,
      },
    ];

    // Add images to content
    if (isMultiFrame) {
      // Add all frames (up to 10)
      frames.slice(0, 10).forEach((frame: any) => {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${frame.imageBase64}`,
          },
        });
      });
    } else {
      // Single frame (legacy support)
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
        },
      });
    }

    // Analyze using OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert movement analyst and sports performance coach. Analyze movement patterns in video frames and provide actionable, coach-focused insights that explain performance impact, not just observations.

Your analysis should answer: "What does this movement mean for performance?"

Format your response as JSON with the following structure:
{
  "postureMetrics": {
    "spineLean": string (e.g., "12° forward (ideal < 5°)"),
    "neckFlexion": string (e.g., "8° (mild forward-head posture)"),
    "shoulderAlignment": string (e.g., "Right +2.1 cm elevation"),
    "pelvicSway": string (e.g., "3–5° oscillation (moderate instability)"),
    "additionalMetrics": array of strings (any other relevant observations)
  },
  "movementQuality": string (e.g., "Smooth and controlled" or "Jerky with compensations" - only for multi-frame analysis),
  "movementPatterns": array of strings (e.g., "Asymmetric weight shift", "Reduced hip mobility" - only for multi-frame analysis),
  "movementConsistency": number (0-100, how consistent movement is across frames - only for multi-frame analysis),
  "dynamicStability": number (0-100, stability throughout movement - only for multi-frame analysis),
  "performanceInterpretation": string (2-3 sentences explaining what these movement patterns/compensations mean for performance - focus on impact, not just observation),
  "performanceImpact": array of strings (specific impacts like "Reduces rotational power output", "Increases low-back fatigue risk during lifting or sprinting", "Decreases efficiency in lateral movement"),
  "balanceScore": number (0-100),
  "symmetryScore": number (0-100),
  "posturalEfficiency": number (0-100),
  "riskLevel": string ("Low" | "Moderate" | "High"),
  "riskDescription": string (brief description of the risk level),
  "targetedRecommendations": array of strings (specific exercises/cues like "Chin tucks – 3×10 reps", "Scapular retractions – 2×12 reps")
}

Focus on:
- ACTUAL MOVEMENT ANALYSIS when multiple frames are provided (how the body moves, movement quality, patterns)
- Performance impact, not just observations
- Specific, actionable recommendations
- Clear risk assessment
- What coaches need to know to help athletes improve`,
        },
        {
          role: 'user',
          content,
        },
      ],
      max_tokens: 2000, // Increased for movement analysis
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');

    return NextResponse.json(
      {
        success: true,
        analysis: {
          postureMetrics: analysis.postureMetrics || {},
          movementQuality: analysis.movementQuality,
          movementPatterns: analysis.movementPatterns || [],
          movementConsistency: analysis.movementConsistency,
          dynamicStability: analysis.dynamicStability,
          performanceInterpretation: analysis.performanceInterpretation || 'No interpretation available',
          performanceImpact: analysis.performanceImpact || [],
          balanceScore: analysis.balanceScore || 0,
          symmetryScore: analysis.symmetryScore || 0,
          posturalEfficiency: analysis.posturalEfficiency || 0,
          riskLevel: analysis.riskLevel || 'Low',
          riskDescription: analysis.riskDescription || '',
          targetedRecommendations: analysis.targetedRecommendations || [],
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error analyzing movement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze movement' },
      { status: 500 }
    );
  }
}

