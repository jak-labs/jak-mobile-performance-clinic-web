import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { saveAIMetric } from '@/lib/dynamodb-ai-metrics';

export async function POST(req: NextRequest) {
  try {
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

    console.log('[API] Saving AI metric - received data:', {
      sessionId: body.sessionId,
      participantId: body.participantId,
      participantName: body.participantName,
      balanceScore: body.balanceScore,
      symmetryScore: body.symmetryScore,
      posturalEfficiency: body.posturalEfficiency,
      riskLevel: body.riskLevel,
      hasPostureMetrics: !!body.postureMetrics,
    });

    const {
      sessionId,
      participantId,
      participantName,
      balanceScore,
      symmetryScore,
      posturalEfficiency,
      riskLevel,
      postureMetrics,
      timestamp,
    } = body;

    const missingFields = [];
    if (!sessionId) missingFields.push('sessionId');
    if (!participantId) missingFields.push('participantId');
    if (!participantName) missingFields.push('participantName');
    if (balanceScore === undefined) missingFields.push('balanceScore');
    if (symmetryScore === undefined) missingFields.push('symmetryScore');

    if (missingFields.length > 0) {
      console.error('[API] Missing required fields:', missingFields);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const postureMetricsSnakeCase = postureMetrics
      ? {
          spine_lean: postureMetrics.spineLean,
          neck_flexion: postureMetrics.neckFlexion,
          shoulder_alignment: postureMetrics.shoulderAlignment,
          pelvic_sway: postureMetrics.pelvicSway,
          additional_metrics: postureMetrics.additionalMetrics,
        }
      : undefined;

    const metricData = {
      session_id: sessionId,
      timestamp: timestamp || new Date().toISOString(),
      participant_id: participantId,
      participant_name: participantName,
      balance_score: balanceScore,
      symmetry_score: symmetryScore,
      postural_efficiency: posturalEfficiency,
      risk_level: riskLevel,
      posture_metrics: postureMetricsSnakeCase,
    };

    console.log('[API] Saving AI metric to DynamoDB:', {
      table: 'jak-coach-session-ai-metrics',
      session_id: metricData.session_id,
      timestamp: metricData.timestamp,
      participant_id: metricData.participant_id,
    });

    await saveAIMetric(metricData);

    console.log('[API] Successfully saved AI metric');

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Error saving AI metric:', error);
    console.error('[API] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      stack: error.stack,
    });
    
    // Provide more helpful error message
    let errorMessage = error.message || 'Failed to save AI metric';
    if (error.code === 'ResourceNotFoundException' || error.message?.includes('does not exist')) {
      errorMessage = 'DynamoDB table "jak-coach-session-ai-metrics" does not exist. Please create the table first.';
    } else if (error.code === 'ValidationException') {
      errorMessage = `Validation error: ${error.message}`;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? {
          name: error.name,
          message: error.message,
          code: error.code,
        } : undefined,
      },
      { status: 500 }
    );
  }
}
