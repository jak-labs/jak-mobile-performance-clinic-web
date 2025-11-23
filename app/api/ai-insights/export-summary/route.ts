import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById } from '@/lib/dynamodb-schedules';
import { getAIInsightsBySession, getAllAIInsightsForSession } from '@/lib/dynamodb-ai-insights';
import { saveAISummary, getAllAISummariesForSession } from '@/lib/dynamodb-ai-summary';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import puppeteer from 'puppeteer';

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

    const { sessionId, participantId } = await req.json();

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

    // Check if summary already exists for this session - we'll overwrite it
    console.log(`[API] Checking for existing summaries for session ${sessionId}`);
    const existingSummaries = await getAllAISummariesForSession(sessionId);
    
    if (existingSummaries.length > 0) {
      console.log(`[API] Found ${existingSummaries.length} existing summary(ies) for session ${sessionId} - will overwrite with new summary`);
    }

    // Fetch all insights for this session directly from the table
    // This ensures we get all insights regardless of whether participants are in the schedule
    console.log(`[API] Fetching all insights for session ${sessionId}`);
    const allInsights = await getAllAIInsightsForSession(sessionId);
    console.log(`[API] Found ${allInsights.length} insights for session ${sessionId}`);

    if (allInsights.length === 0) {
      return NextResponse.json(
        { error: 'No insights found for this session' },
        { status: 400 }
      );
    }

    // Group insights by participant
    const insightsByParticipant = allInsights.reduce((acc, insight) => {
      const pid = insight.participant_id || insight.subject_id;
      if (!acc[pid]) {
        acc[pid] = [];
      }
      acc[pid].push(insight);
      return acc;
    }, {} as Record<string, typeof allInsights>);

    // Generate summary for each participant
    const summaryPromises = Object.entries(insightsByParticipant).map(async ([participantId, insights]) => {
      // Calculate average metrics
      const metrics = {
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

      insights.forEach(insight => {
        if (insight.balance_score) {
          totalBalance += insight.balance_score;
          balanceCount++;
        }
        if (insight.symmetry_score) {
          totalSymmetry += insight.symmetry_score;
          symmetryCount++;
        }
        if (insight.postural_efficiency) {
          totalEfficiency += insight.postural_efficiency;
          efficiencyCount++;
        }
        if (insight.risk_level) {
          riskLevels.push(insight.risk_level);
        }
      });

      metrics.average_balance_score = balanceCount > 0 ? totalBalance / balanceCount : 0;
      metrics.average_symmetry_score = symmetryCount > 0 ? totalSymmetry / symmetryCount : 0;
      metrics.average_postural_efficiency = efficiencyCount > 0 ? totalEfficiency / efficiencyCount : 0;

      // Determine overall risk level (most common or highest)
      if (riskLevels.length > 0) {
        const riskCounts = riskLevels.reduce((acc, risk) => {
          acc[risk] = (acc[risk] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const sortedRisks = Object.entries(riskCounts).sort((a, b) => b[1] - a[1]);
        metrics.risk_level = sortedRisks[0][0];
      }

      // Prepare insights data for LLM
      const insightsData = insights.map(insight => ({
        timestamp: insight.timestamp,
        postureMetrics: insight.posture_metrics,
        performanceInterpretation: insight.performance_interpretation,
        performanceImpact: insight.performance_impact,
        balanceScore: insight.balance_score,
        symmetryScore: insight.symmetry_score,
        posturalEfficiency: insight.postural_efficiency,
        riskLevel: insight.risk_level,
        riskDescription: insight.risk_description,
        targetedRecommendations: insight.targeted_recommendations,
      }));

      // Generate summary using LLM
      const participantName = insights[0]?.participant_name || participantId;
      
      const prompt = `You are an expert movement analyst and sports performance coach. Analyze the following collection of AI movement analysis insights from a coaching session and create a comprehensive summary report.

Participant: ${participantName}
Total Insights Analyzed: ${insights.length}
Average Metrics:
- Balance Score: ${metrics.average_balance_score.toFixed(1)}/100
- Symmetry Score: ${metrics.average_symmetry_score.toFixed(1)}/100
- Postural Efficiency: ${metrics.average_postural_efficiency.toFixed(1)}/100
- Overall Risk Level: ${metrics.risk_level}

Insights Data:
${JSON.stringify(insightsData, null, 2)}

Please provide a comprehensive summary in JSON format with the following structure:
{
  "summary": "A comprehensive 3-4 paragraph summary of the movement patterns, trends, and overall performance observed throughout the session. Highlight key patterns, improvements, or concerns.",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3", ...], // 5-7 key findings
  "recommendations": ["Recommendation 1", "Recommendation 2", ...], // 5-7 actionable recommendations
  "overall_assessment": "A brief 2-3 sentence overall assessment of the participant's movement quality and performance"
}

Focus on:
- Identifying patterns and trends across all insights
- Highlighting consistent issues or improvements
- Providing actionable recommendations based on the full session data
- Overall performance trajectory`;

      console.log(`[API] Generating summary for participant ${participantId} with ${insights.length} insights`);

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

      const summaryData = JSON.parse(response.choices[0].message.content || '{}');

      // Check if summary already exists for this participant in this session
      // If it exists, we'll use the same summary_id to overwrite it
      // Otherwise, generate a new one
      let summaryId: string;
      const existingSummary = existingSummaries.find(s => s.participant_id === participantId);
      
      if (existingSummary) {
        // Use existing summary_id to overwrite
        summaryId = existingSummary.summary_id;
        console.log(`[API] Overwriting existing summary ${summaryId} for participant ${participantId}`);
      } else {
        // Generate new summary ID
        summaryId = `${Date.now()}-${randomUUID()}`;
        console.log(`[API] Creating new summary ${summaryId} for participant ${participantId}`);
      }

      // Save summary to database (PutCommand will overwrite if key exists)
      await saveAISummary({
        session_id: sessionId,
        summary_id: summaryId,
        participant_id: participantId,
        participant_name: participantName,
        summary: summaryData.summary || 'No summary available',
        key_findings: summaryData.key_findings || [],
        recommendations: summaryData.recommendations || [],
        overall_assessment: summaryData.overall_assessment || 'No assessment available',
        metrics_summary: metrics,
        insights_count: insights.length,
      });

      return {
        participantId,
        participantName,
        summaryId,
        summary: summaryData,
        metrics,
      };
    });

    const summaries = await Promise.all(summaryPromises);

    // Generate PDF for each summary
    const pdfBuffers: Buffer[] = [];
    for (const summaryResult of summaries) {
      const pdfBuffer = await generatePDF(summaryResult, dbSession);
      pdfBuffers.push(pdfBuffer);
    }

    // If only one summary, return it directly as PDF
    // Otherwise, we could combine them or return the first one
    const pdfBuffer = pdfBuffers[0] || Buffer.alloc(0);

    // Return PDF as download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ai-insights-summary-${sessionId}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[API] Error exporting AI insights summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export AI insights summary' },
      { status: 500 }
    );
  }
}

/**
 * Generate PDF from summary data using Puppeteer
 */
async function generatePDF(
  summaryResult: {
    participantId: string;
    participantName: string;
    summaryId: string;
    summary: any;
    metrics: any;
  },
  session: any
): Promise<Buffer> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      text-align: center;
      color: #2c3e50;
      margin-bottom: 30px;
      font-size: 24px;
    }
    h2 {
      color: #34495e;
      border-bottom: 2px solid #3498db;
      padding-bottom: 5px;
      margin-top: 25px;
      margin-bottom: 15px;
      font-size: 18px;
    }
    .info {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .info p {
      margin: 5px 0;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .metric-item {
      padding: 10px;
      background-color: #ecf0f1;
      border-radius: 5px;
    }
    .metric-label {
      font-weight: bold;
      color: #7f8c8d;
      font-size: 12px;
    }
    .metric-value {
      font-size: 18px;
      color: #2c3e50;
    }
    ul {
      list-style-type: none;
      padding-left: 0;
    }
    li {
      padding: 8px 0;
      padding-left: 25px;
      position: relative;
    }
    li:before {
      content: counter(item) ".";
      counter-increment: item;
      position: absolute;
      left: 0;
      font-weight: bold;
      color: #3498db;
    }
    .findings, .recommendations {
      counter-reset: item;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 10px;
      color: #7f8c8d;
    }
    .text-content {
      text-align: justify;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>AI Movement Analysis Summary</h1>
  
  <div class="info">
    <p><strong>Session:</strong> ${session.title || session.session_id}</p>
    <p><strong>Participant:</strong> ${summaryResult.participantName}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <h2>Performance Metrics</h2>
  <div class="metrics">
    <div class="metric-item">
      <div class="metric-label">Average Balance Score</div>
      <div class="metric-value">${summaryResult.metrics.average_balance_score.toFixed(1)}/100</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Average Symmetry Score</div>
      <div class="metric-value">${summaryResult.metrics.average_symmetry_score.toFixed(1)}/100</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Average Postural Efficiency</div>
      <div class="metric-value">${summaryResult.metrics.average_postural_efficiency.toFixed(1)}/100</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Overall Risk Level</div>
      <div class="metric-value">${summaryResult.metrics.risk_level}</div>
    </div>
  </div>

  ${summaryResult.summary.overall_assessment ? `
  <h2>Overall Assessment</h2>
  <div class="text-content">
    ${summaryResult.summary.overall_assessment}
  </div>
  ` : ''}

  ${summaryResult.summary.summary ? `
  <h2>Summary</h2>
  <div class="text-content">
    ${summaryResult.summary.summary}
  </div>
  ` : ''}

  ${summaryResult.summary.key_findings && summaryResult.summary.key_findings.length > 0 ? `
  <h2>Key Findings</h2>
  <ul class="findings">
    ${summaryResult.summary.key_findings.map((finding: string) => `<li>${finding}</li>`).join('')}
  </ul>
  ` : ''}

  ${summaryResult.summary.recommendations && summaryResult.summary.recommendations.length > 0 ? `
  <h2>Recommendations</h2>
  <ul class="recommendations">
    ${summaryResult.summary.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
  </ul>
  ` : ''}

  <div class="footer">
    Generated on ${new Date().toLocaleString()}
  </div>
</body>
</html>
  `;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });
    
    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

