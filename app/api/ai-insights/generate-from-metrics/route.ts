import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById } from '@/lib/dynamodb-schedules';
import { getAllAIMetricsForSession } from '@/lib/dynamodb-ai-metrics';
import { saveAIInsight } from '@/lib/dynamodb-ai-insights';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
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

    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get session details
    const dbSession = await getSessionById(sessionId);
    
    if (!dbSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch all metrics for this session
    console.log(`[API] Fetching all metrics for session ${sessionId}`);
    const allMetrics = await getAllAIMetricsForSession(sessionId);
    console.log(`[API] Found ${allMetrics.length} metrics for session ${sessionId}`);

    if (allMetrics.length === 0) {
      return NextResponse.json(
        { error: 'No metrics found for this session. Please wait for metrics to be collected.' },
        { status: 400 }
      );
    }

    // Group metrics by participant
    const metricsByParticipant = allMetrics.reduce((acc, metric) => {
      const pid = metric.participant_id;
      if (!acc[pid]) {
        acc[pid] = [];
      }
      acc[pid].push(metric);
      return acc;
    }, {} as Record<string, typeof allMetrics>);

    // Generate insights for each participant
    const insightPromises = Object.entries(metricsByParticipant).map(async ([participantId, metrics]) => {
      const participantName = metrics[0]?.participant_name || participantId;
      
      // Calculate average metrics
      const avgMetrics = {
        average_balance_score: 0,
        average_symmetry_score: 0,
        average_postural_efficiency: 0,
        risk_level: 'Low' as string,
      };

      let totalBalance = 0;
      let totalSymmetry = 0;
      let totalEfficiency = 0;
      let balanceCount = 0;
      let symmetryCount = 0;
      let efficiencyCount = 0;
      const riskLevels: string[] = [];
      
      metrics.forEach((metric) => {
        if (typeof metric.balance_score === 'number') {
          totalBalance += metric.balance_score;
          balanceCount++;
        }
        if (typeof metric.symmetry_score === 'number') {
          totalSymmetry += metric.symmetry_score;
          symmetryCount++;
        }
        if (typeof metric.postural_efficiency === 'number') {
          totalEfficiency += metric.postural_efficiency;
          efficiencyCount++;
        }
        if (metric.risk_level) {
          riskLevels.push(metric.risk_level);
        }
      });

      avgMetrics.average_balance_score = balanceCount > 0 ? totalBalance / balanceCount : 0;
      avgMetrics.average_symmetry_score = symmetryCount > 0 ? totalSymmetry / symmetryCount : 0;
      avgMetrics.average_postural_efficiency = efficiencyCount > 0 ? totalEfficiency / efficiencyCount : 0;
      
      // Determine overall risk level (most common)
      if (riskLevels.length > 0) {
        const riskCounts = riskLevels.reduce((acc, risk) => {
          acc[risk] = (acc[risk] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const sortedRisks = Object.entries(riskCounts).sort((a, b) => b[1] - a[1]);
        avgMetrics.risk_level = sortedRisks[0][0];
      }

      // Prepare metrics data for LLM (simplified - just the essential data)
      const metricsData = metrics.map(metric => ({
        timestamp: metric.timestamp,
        balance_score: metric.balance_score,
        symmetry_score: metric.symmetry_score,
        postural_efficiency: metric.postural_efficiency,
        risk_level: metric.risk_level,
        posture_metrics: metric.posture_metrics,
      }));

      // Generate insight using LLM
      const prompt = `You are an expert movement analyst and sports performance coach. Analyze the following collection of movement metrics from a coaching session and create a comprehensive insight report.

Participant: ${participantName}
Total Metrics Analyzed: ${metrics.length}
Average Metrics:
- Balance Score: ${avgMetrics.average_balance_score.toFixed(1)}/100
- Symmetry Score: ${avgMetrics.average_symmetry_score.toFixed(1)}/100
- Postural Efficiency: ${avgMetrics.average_postural_efficiency.toFixed(1)}/100
- Overall Risk Level: ${avgMetrics.risk_level}

Metrics Data (chronological):
${JSON.stringify(metricsData, null, 2)}

Please provide a comprehensive insight in JSON format with the following structure:
{
  "movementQuality": "Brief description of overall movement quality (e.g., 'Controlled with minor adjustments')",
  "movementPatterns": ["Pattern 1", "Pattern 2", ...], // 2-4 key movement patterns observed
  "movementConsistency": 85, // Number 0-100 representing consistency
  "dynamicStability": 90, // Number 0-100 representing dynamic stability
  "performanceInterpretation": "A comprehensive 2-3 paragraph interpretation of the movement patterns, trends, and overall performance observed throughout the session.",
  "performanceImpact": ["Impact 1", "Impact 2", ...], // 2-3 key performance impacts
  "balanceScore": ${avgMetrics.average_balance_score.toFixed(1)},
  "symmetryScore": ${avgMetrics.average_symmetry_score.toFixed(1)},
  "posturalEfficiency": ${avgMetrics.average_postural_efficiency.toFixed(1)},
  "riskLevel": "${avgMetrics.risk_level}",
  "riskDescription": "Brief description of risk level and what it means",
  "targetedRecommendations": ["Recommendation 1", "Recommendation 2", ...] // 2-3 actionable recommendations
}

Focus on:
- Identifying patterns and trends across all metrics
- Highlighting consistent issues or improvements
- Providing actionable recommendations based on the full session data
- Overall performance trajectory`;

      console.log(`[API] Generating insight for participant ${participantId} with ${metrics.length} metrics`);

      // Retry logic for rate limit errors
      const maxRetries = 3;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are an expert movement analyst and sports performance coach. Provide detailed, actionable insights based on movement analysis data.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 2000,
            response_format: { type: 'json_object' },
          });

          // Success - parse and save
          const insightData = JSON.parse(response.choices[0].message.content || '{}');

          // Generate insight ID (use session_id + participant_id as unique identifier)
          // This ensures we overwrite previous insights for this participant in this session
          const insightId = `${sessionId}-${participantId}`;

          // Get latest metric for posture_metrics
          const latestMetric = metrics[metrics.length - 1];

          // Save insight to database (will overwrite if exists)
          await saveAIInsight({
            session_id: sessionId,
            insight_id: insightId,
            participant_id: participantId,
            participant_name: participantName,
            posture_metrics: latestMetric.posture_metrics,
            performance_interpretation: insightData.performanceInterpretation,
            performance_impact: insightData.performanceImpact || [],
            balance_score: insightData.balanceScore || avgMetrics.average_balance_score,
            symmetry_score: insightData.symmetryScore || avgMetrics.average_symmetry_score,
            postural_efficiency: insightData.posturalEfficiency || avgMetrics.average_postural_efficiency,
            risk_level: insightData.riskLevel || avgMetrics.risk_level,
            risk_description: insightData.riskDescription,
            targeted_recommendations: insightData.targetedRecommendations || [],
            timestamp: new Date().toISOString(),
            // Add movement analysis fields
            movement_quality: insightData.movementQuality,
            movement_patterns: insightData.movementPatterns || [],
            movement_consistency: insightData.movementConsistency,
            dynamic_stability: insightData.dynamicStability,
          });

          return {
            participantId,
            participantName,
            insight: {
              ...insightData,
              balanceScore: insightData.balanceScore || avgMetrics.average_balance_score,
              symmetryScore: insightData.symmetryScore || avgMetrics.average_symmetry_score,
              posturalEfficiency: insightData.posturalEfficiency || avgMetrics.average_postural_efficiency,
              riskLevel: insightData.riskLevel || avgMetrics.risk_level,
              postureMetrics: latestMetric.posture_metrics,
            },
          };
        } catch (error: any) {
          lastError = error;
          
          // Check if it's a rate limit error (429)
          const isRateLimit = error.status === 429 || 
                             error.response?.status === 429 || 
                             error.code === 'rate_limit_exceeded' ||
                             (error.message && error.message.includes('Rate limit'));
          
          if (isRateLimit) {
            let retryAfter = Math.pow(2, attempt) * 2; // Exponential backoff: 4s, 8s, 16s
            
            // Try to parse retry-after from error message
            const retryMatch = error.message?.match(/try again in ([\d.]+)s/i);
            if (retryMatch) {
              retryAfter = Math.ceil(parseFloat(retryMatch[1])) + 1; // Add 1 second buffer
            } else if (error.response?.headers?.['retry-after']) {
              retryAfter = parseInt(error.response.headers['retry-after'], 10);
            }
            
            console.warn(`[API] Rate limit hit for participant ${participantId} (attempt ${attempt}/${maxRetries}). Retrying after ${retryAfter} seconds...`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              continue; // Retry
            } else {
              throw new Error(`Rate limit exceeded after ${maxRetries} attempts. Please try again later.`);
            }
          } else {
            // Not a rate limit error - throw immediately
            throw error;
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Failed to generate insight after retries');
    });

    // Process insights sequentially with delays to avoid rate limits
    const insights: any[] = [];
    const participantEntries = Object.entries(metricsByParticipant);
    
    for (let i = 0; i < participantEntries.length; i++) {
      // Add delay between participants (except the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
      
      try {
        const result = await insightPromises[i];
        insights.push(result);
      } catch (error: any) {
        console.error(`[API] Failed to generate insight for participant:`, error);
        // Continue with next participant instead of failing entire request
      }
    }

    console.log(`[API] Successfully generated ${insights.length} insight(s) for session ${sessionId}`);

    return NextResponse.json(
      {
        success: true,
        message: `Successfully generated ${insights.length} insight(s)`,
        sessionId,
        insights,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Error generating insights from metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights from metrics' },
      { status: 500 }
    );
  }
}
