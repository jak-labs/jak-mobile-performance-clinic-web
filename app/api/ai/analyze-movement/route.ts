import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, participantName, exerciseName } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Analyze the image using OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert movement analyst and sports performance coach. Analyze movement patterns in video frames and provide actionable, coach-focused insights that explain performance impact, not just observations.

Your analysis should answer: "What does this mean for performance?"

Format your response as JSON with the following structure:
{
  "postureMetrics": {
    "spineLean": string (e.g., "12° forward (ideal < 5°)"),
    "neckFlexion": string (e.g., "8° (mild forward-head posture)"),
    "shoulderAlignment": string (e.g., "Right +2.1 cm elevation"),
    "pelvicSway": string (e.g., "3–5° oscillation (moderate instability)"),
    "additionalMetrics": array of strings (any other relevant observations)
  },
  "performanceInterpretation": string (2-3 sentences explaining what these compensations mean for performance - focus on impact, not just observation),
  "performanceImpact": array of strings (specific impacts like "Reduces rotational power output", "Increases low-back fatigue risk during lifting or sprinting", "Decreases efficiency in lateral movement"),
  "balanceScore": number (0-100),
  "symmetryScore": number (0-100),
  "posturalEfficiency": number (0-100),
  "riskLevel": string ("Low" | "Moderate" | "High"),
  "riskDescription": string (brief description of the risk level),
  "targetedRecommendations": array of strings (specific exercises/cues like "Chin tucks – 3×10 reps", "Scapular retractions – 2×12 reps")
}

Focus on:
- Performance impact, not just observations
- Specific, actionable recommendations
- Clear risk assessment
- What coaches need to know to help athletes improve`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this movement frame${exerciseName ? ` for the exercise: ${exerciseName}` : ''}${participantName ? ` for participant: ${participantName}` : ''}. 

Provide a comprehensive movement analysis that includes:
1. Posture metrics with specific measurements/observations
2. Performance interpretation explaining what this means for athletic performance
3. Performance impact - specific ways this affects performance
4. Scores (balance, symmetry, postural efficiency)
5. Risk level assessment
6. Targeted recommendations with specific exercises and reps

Focus on actionable insights that help coaches understand the performance implications.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');

    return NextResponse.json(
      {
        success: true,
        analysis: {
          postureMetrics: analysis.postureMetrics || {},
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

