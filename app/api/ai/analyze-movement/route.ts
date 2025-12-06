import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poseData, frames, imageBase64, participantName, exerciseName, participantId } = body;

    // Support pose data (new), frames (legacy), or single image (legacy)
    const hasPoseData = Array.isArray(poseData) && poseData.length > 0;
    const isMultiFrame = Array.isArray(frames) && frames.length > 0;
    const singleFrame = imageBase64;

    if (!hasPoseData && !isMultiFrame && !singleFrame) {
      return NextResponse.json(
        { error: 'Pose data, image data, or frames array is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build content for OpenAI API
    let content: any[] = [];

    if (hasPoseData) {
      // NEW: Analyze pose data (biomechanical keypoints and angles)
      const poseDataToAnalyze = poseData.slice(0, 10); // Up to 10 poses (10 seconds of data)
      
      // Calculate averages from pose data
      const avgAngles = poseDataToAnalyze.reduce((acc: any, pose: any) => {
        if (pose.angles) {
          Object.keys(pose.angles).forEach((key) => {
            if (pose.angles[key] !== null && pose.angles[key] !== undefined) {
              acc[key] = (acc[key] || 0) + pose.angles[key];
              acc[`${key}_count`] = (acc[`${key}_count`] || 0) + 1;
            }
          });
        }
        return acc;
      }, {});

      const avgMetrics = poseDataToAnalyze.reduce((acc: any, pose: any) => {
        if (pose.metrics) {
          acc.balanceScore = (acc.balanceScore || 0) + pose.metrics.balanceScore;
          acc.symmetryScore = (acc.symmetryScore || 0) + pose.metrics.symmetryScore;
          acc.posturalEfficiency = (acc.posturalEfficiency || 0) + pose.metrics.posturalEfficiency;
        }
        return acc;
      }, {});

      const count = poseDataToAnalyze.length;
      const avgBalanceScore = count > 0 ? Math.round(avgMetrics.balanceScore / count) : 0;
      const avgSymmetryScore = count > 0 ? Math.round(avgMetrics.symmetryScore / count) : 0;
      const avgPosturalEfficiency = count > 0 ? Math.round(avgMetrics.posturalEfficiency / count) : 0;

      // Format angles for display
      const formattedAngles: any = {};
      Object.keys(avgAngles).forEach((key) => {
        if (!key.endsWith('_count')) {
          const angleCount = avgAngles[`${key}_count`] || 1;
          formattedAngles[key] = Math.round(avgAngles[key] / angleCount);
        }
      });

      // Calculate movement consistency (coefficient of variation for key angles)
      const calculateConsistency = (angles: number[]): number => {
        if (angles.length === 0) return 0;
        const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
        const variance = angles.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / angles.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;
        return Math.max(0, Math.min(100, 100 - cv)); // Higher consistency = lower CV
      };

      const leftKneeAngles = poseDataToAnalyze
        .map((p: any) => p.angles?.leftKnee)
        .filter((a: any) => a !== null && a !== undefined);
      const rightKneeAngles = poseDataToAnalyze
        .map((p: any) => p.angles?.rightKnee)
        .filter((a: any) => a !== null && a !== undefined);
      const spineLeanAngles = poseDataToAnalyze
        .map((p: any) => p.angles?.spineLean)
        .filter((a: any) => a !== null && a !== undefined);

      const movementConsistency = Math.round(
        (calculateConsistency(leftKneeAngles) + 
         calculateConsistency(rightKneeAngles) + 
         calculateConsistency(spineLeanAngles)) / 3
      );

      // Calculate dynamic stability (based on balance score variance)
      const balanceScores = poseDataToAnalyze
        .map((p: any) => p.metrics?.balanceScore)
        .filter((s: any) => s !== null && s !== undefined);
      const balanceVariance = balanceScores.length > 0
        ? balanceScores.reduce((sum: number, score: number) => {
            const mean = balanceScores.reduce((a: number, b: number) => a + b, 0) / balanceScores.length;
            return sum + Math.pow(score - mean, 2);
          }, 0) / balanceScores.length
        : 0;
      const dynamicStability = Math.max(0, Math.min(100, 100 - Math.sqrt(balanceVariance)));

      content = [
        {
          type: 'text',
          text: `Analyze this biomechanical movement sequence${exerciseName ? ` for the exercise: ${exerciseName}` : ''}${participantName ? ` for participant: ${participantName}` : ''}.

These ${poseDataToAnalyze.length} pose data points were captured over ${poseDataToAnalyze.length} seconds (collected every 1 second, analyzed every 10 seconds). Each pose contains:
- 33 body keypoints (x, y, z coordinates with visibility scores)
- Calculated joint angles (knee, hip, shoulder, elbow, spine lean, neck flexion)
- Biomechanical metrics (balance score, symmetry score, postural efficiency)

Average Joint Angles (degrees):
${Object.entries(formattedAngles).map(([key, value]) => `- ${key}: ${value}°`).join('\n')}

Average Metrics:
- Balance Score: ${avgBalanceScore}/100
- Symmetry Score: ${avgSymmetryScore}/100
- Postural Efficiency: ${avgPosturalEfficiency}/100
- Movement Consistency: ${movementConsistency}/100 (calculated from angle variance)
- Dynamic Stability: ${dynamicStability}/100 (calculated from balance score stability)

Pose Data Sequence:
${poseDataToAnalyze.map((pose: any, idx: number) => {
  const angles = pose.angles || {};
  const metrics = pose.metrics || {};
  return `Pose ${idx + 1} at ${pose.timestamp}s:
  - Left Knee: ${angles.leftKnee !== null && angles.leftKnee !== undefined ? `${Math.round(angles.leftKnee)}°` : 'N/A'}
  - Right Knee: ${angles.rightKnee !== null && angles.rightKnee !== undefined ? `${Math.round(angles.rightKnee)}°` : 'N/A'}
  - Spine Lean: ${angles.spineLean !== null && angles.spineLean !== undefined ? `${Math.round(angles.spineLean)}°` : 'N/A'}
  - Neck Flexion: ${angles.neckFlexion !== null && angles.neckFlexion !== undefined ? `${Math.round(angles.neckFlexion)}°` : 'N/A'}
  - Balance: ${metrics.balanceScore || 'N/A'}, Symmetry: ${metrics.symmetryScore || 'N/A'}`;
}).join('\n\n')}

Provide a comprehensive movement analysis that includes:
1. Movement quality assessment (smoothness, control, efficiency) based on angle changes over time
2. Movement patterns observed across the sequence (compensations, asymmetries, deviations)
3. Range of motion analysis (how joint angles change over time)
4. Movement consistency (use provided value: ${movementConsistency}/100)
5. Dynamic stability (use provided value: ${dynamicStability}/100)
6. Posture metrics with specific angle measurements and observations
7. Performance interpretation explaining what these movement patterns mean for athletic performance
8. Performance impact - specific ways movement quality affects performance
9. Scores (use provided balance: ${avgBalanceScore}, symmetry: ${avgSymmetryScore}, postural efficiency: ${avgPosturalEfficiency}, movement consistency: ${movementConsistency}, dynamic stability: ${dynamicStability})
10. Risk level assessment based on movement quality and angle deviations
11. Targeted recommendations with specific exercises and reps

Focus on:
- ACTUAL MOVEMENT ANALYSIS using the biomechanical data (how joint angles change, movement quality, patterns)
- Performance impact, not just observations
- Specific, actionable recommendations based on the angle data
- Clear risk assessment
- What coaches need to know to help athletes improve`,
        },
      ];
    } else if (isMultiFrame) {
      // Legacy: Multi-frame image analysis
      content = [
        {
          type: 'text',
          text: `Analyze this movement sequence${exerciseName ? ` for the exercise: ${exerciseName}` : ''}${participantName ? ` for participant: ${participantName}` : ''}. 

These ${frames.length} frames were captured over 30 seconds (every 3 seconds). Analyze the ACTUAL MOVEMENT patterns, not just static posture.

Provide a comprehensive movement analysis that includes:
1. Movement quality assessment (smoothness, control, efficiency)
2. Movement patterns observed across the sequence (compensations, asymmetries, deviations)
3. Range of motion analysis (how movement changes over time)
4. Movement consistency (how consistent movement is across frames)
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

Frame sequence: ${frames.map((f: any, idx: number) => `Frame ${idx + 1} at ${f.timestamp}s`).join(', ')}`,
        },
      ];

      // Add images to content
      frames.slice(0, 10).forEach((frame: any) => {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${frame.imageBase64}`,
          },
        });
      });
    } else {
      // Legacy: Single frame analysis
      content = [
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
      ];
    }

    // Analyze using OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert movement analyst and sports performance coach. Analyze movement patterns using biomechanical data (pose keypoints, joint angles, metrics) and provide actionable, coach-focused insights that explain performance impact, not just observations.

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
  "movementQuality": string (e.g., "Smooth and controlled" or "Jerky with compensations" - only for multi-pose analysis),
  "movementPatterns": array of strings (e.g., "Asymmetric weight shift", "Reduced hip mobility" - only for multi-pose analysis),
  "movementConsistency": number (0-100, how consistent movement is across poses - use provided value if available),
  "dynamicStability": number (0-100, stability throughout movement - use provided value if available),
  "performanceInterpretation": string (2-3 sentences explaining what these movement patterns/compensations mean for performance - focus on impact, not just observation),
  "performanceImpact": array of strings (specific impacts like "Reduces rotational power output", "Increases low-back fatigue risk during lifting or sprinting", "Decreases efficiency in lateral movement"),
  "balanceScore": number (0-100, use provided value if available),
  "symmetryScore": number (0-100, use provided value if available),
  "posturalEfficiency": number (0-100, use provided value if available),
  "riskLevel": string ("Low" | "Moderate" | "High"),
  "riskDescription": string (brief description of the risk level),
  "targetedRecommendations": array of strings (specific exercises/cues like "Chin tucks – 3×10 reps", "Scapular retractions – 2×12 reps")
}

Focus on:
- ACTUAL MOVEMENT ANALYSIS when multiple poses are provided (how joint angles change, movement quality, patterns)
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
      max_tokens: 2000,
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
