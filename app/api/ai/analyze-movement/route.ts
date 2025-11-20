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
          content: `You are an expert movement analyst and sports performance coach. Analyze movement patterns in video frames and provide concise, actionable insights. Focus on:
- Balance and stability scores (0-100)
- Symmetry between left and right sides
- Range of motion
- Movement inefficiencies
- Specific recommendations for improvement

Format your response as JSON with:
{
  "balanceScore": number (0-100),
  "symmetryScore": number (0-100),
  "insights": string (concise analysis),
  "recommendations": string (actionable advice)
}`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this movement frame${exerciseName ? ` for the exercise: ${exerciseName}` : ''}${participantName ? ` for participant: ${participantName}` : ''}. Provide movement analysis focusing on balance, symmetry, range of motion, and any inefficiencies.`,
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
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');

    return NextResponse.json(
      {
        success: true,
        analysis: {
          balanceScore: analysis.balanceScore || 0,
          symmetryScore: analysis.symmetryScore || 0,
          insights: analysis.insights || 'No insights available',
          recommendations: analysis.recommendations || 'Continue practicing',
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

