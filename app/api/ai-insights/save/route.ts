import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { saveAIInsight } from '@/lib/dynamodb-ai-insights';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.error('[API] Unauthorized - no session user ID');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[API] Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    console.log('[API] Saving AI insight - received data:', {
      sessionId: body.sessionId,
      participantId: body.participantId,
      participantName: body.participantName,
      hasPostureMetrics: !!body.postureMetrics,
      balanceScore: body.balanceScore,
      symmetryScore: body.symmetryScore,
    });

    const {
      sessionId,
      participantId,
      participantName,
      exerciseName,
      postureMetrics,
      performanceInterpretation,
      performanceImpact,
      balanceScore,
      symmetryScore,
      posturalEfficiency,
      riskLevel,
      riskDescription,
      targetedRecommendations,
      timestamp,
      movementQuality,
      movementPatterns,
      movementConsistency,
      dynamicStability,
    } = body;

    if (!sessionId || !participantId || !participantName) {
      const missingFields = {
        sessionId: !sessionId,
        participantId: !participantId,
        participantName: !participantName,
      };
      console.error('[API] Missing required fields:', missingFields);
      console.error('[API] Received body:', JSON.stringify(body, null, 2));
      return NextResponse.json(
        { 
          error: 'sessionId, participantId, and participantName are required',
          missingFields,
          received: {
            hasSessionId: !!sessionId,
            hasParticipantId: !!participantId,
            hasParticipantName: !!participantName,
          }
        },
        { status: 400 }
      );
    }

    // Generate unique insight ID (timestamp-based UUID)
    const insightId = `${Date.now()}-${randomUUID()}`;

    // Convert camelCase to snake_case for posture metrics
    const postureMetricsSnakeCase = postureMetrics
      ? {
          spine_lean: postureMetrics.spineLean,
          neck_flexion: postureMetrics.neckFlexion,
          shoulder_alignment: postureMetrics.shoulderAlignment,
          pelvic_sway: postureMetrics.pelvicSway,
          additional_metrics: postureMetrics.additionalMetrics,
        }
      : undefined;

    const insightData = {
      session_id: sessionId, // Will be combined with insight_id in the helper
      insight_id: insightId,
      participant_id: participantId, // This will be used as subject_id (partition key)
      participant_name: participantName,
      exercise_name: exerciseName,
      posture_metrics: postureMetricsSnakeCase,
      performance_interpretation: performanceInterpretation,
      performance_impact: performanceImpact,
      balance_score: balanceScore || 0,
      symmetry_score: symmetryScore || 0,
      postural_efficiency: posturalEfficiency,
      movement_quality: movementQuality,
      movement_patterns: movementPatterns,
      movement_consistency: movementConsistency,
      dynamic_stability: dynamicStability,
      risk_level: riskLevel,
      risk_description: riskDescription,
      targeted_recommendations: targetedRecommendations,
      timestamp: timestamp || new Date().toISOString(),
    };

    console.log('[API] Saving AI insight to DynamoDB:', {
      table: 'jak-coach-session-ai-insights',
      session_id: insightData.session_id,
      insight_id: insightData.insight_id,
      participant_id: insightData.participant_id,
    });

    await saveAIInsight(insightData);

    console.log('[API] Successfully saved AI insight:', insightId);

    return NextResponse.json(
      { success: true, insightId },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Error saving AI insight:', error);
    console.error('[API] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to save AI insight' },
      { status: 500 }
    );
  }
}

