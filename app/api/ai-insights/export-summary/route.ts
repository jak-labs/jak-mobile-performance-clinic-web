import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById } from '@/lib/dynamodb-schedules';
import { getAIInsightsBySession, getAllAIInsightsForSession } from '@/lib/dynamodb-ai-insights';
import { saveAISummary, getAllAISummariesForSession } from '@/lib/dynamodb-ai-summary';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

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

    const { sessionId, participantId } = body;

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

    // Fetch all insights for this session (should be 1 per participant now)
    console.log(`[API] Fetching insights for session ${sessionId}`);
    const allInsights = await getAllAIInsightsForSession(sessionId);
    console.log(`[API] Found ${allInsights.length} insight(s) for session ${sessionId}`);

    if (allInsights.length === 0) {
      return NextResponse.json(
        { error: 'No insights found for this session. Please generate insights first using "Generate Session Insights".' },
        { status: 400 }
      );
    }

    // Group insights by participant (should be 1 per participant)
    const insightsByParticipant = allInsights.reduce((acc, insight) => {
      const pid = insight.participant_id || insight.subject_id;
      // Since we now have only 1 insight per participant, just store it
      if (!acc[pid]) {
        acc[pid] = [];
      }
      acc[pid].push(insight);
      return acc;
    }, {} as Record<string, typeof allInsights>);

    // Process each participant's insight (use insight data directly - no LLM summarization needed)
    const summaryPromises = Object.entries(insightsByParticipant).map(async ([participantId, insights]) => {
      // Should only be 1 insight per participant now
      const insight = insights[0];
      const participantName = insight.participant_name || participantId;
      
      // Use insight data directly - convert to summary format for PDF generation
      const metrics = {
        average_balance_score: insight.balance_score || 0,
        average_symmetry_score: insight.symmetry_score || 0,
        average_postural_efficiency: insight.postural_efficiency || 0,
        risk_level: insight.risk_level || 'Low',
      };

      // Convert insight to summary format (for PDF generation)
      // The insight already contains all the analysis, we just need to format it for the PDF
      const summaryData = {
        summary: insight.performance_interpretation || 'No summary available',
        key_findings: [
          insight.movement_quality ? `Movement Quality: ${insight.movement_quality}` : null,
          ...(insight.movement_patterns || []),
          insight.risk_description || null,
        ].filter(Boolean) as string[],
        recommendations: insight.targeted_recommendations || [],
        overall_assessment: insight.performance_interpretation || 'No assessment available',
      };

      // Check if summary already exists for this participant in this session
      let summaryId: string;
      const existingSummary = existingSummaries.find(s => s.participant_id === participantId);
      
      if (existingSummary) {
        summaryId = existingSummary.summary_id;
        console.log(`[API] Using existing summary ${summaryId} for participant ${participantId}`);
      } else {
        summaryId = `${Date.now()}-${randomUUID()}`;
        console.log(`[API] Creating new summary ${summaryId} for participant ${participantId}`);
      }

      // Save summary to database (for PDF generation)
      await saveAISummary({
        session_id: sessionId,
        summary_id: summaryId,
        participant_id: participantId,
        participant_name: participantName,
        summary: summaryData.summary,
        key_findings: summaryData.key_findings,
        recommendations: summaryData.recommendations,
        overall_assessment: summaryData.overall_assessment,
        metrics_summary: metrics,
        insights_count: 1, // Only 1 insight per participant now
      });

      return {
        participantId,
        participantName,
        summaryId,
        summary: summaryData,
        metrics,
        // Include insight data for PDF generation
        insight: {
          movementQuality: insight.movement_quality,
          movementPatterns: insight.movement_patterns || [],
          movementConsistency: insight.movement_consistency,
          dynamicStability: insight.dynamic_stability,
          performanceInterpretation: insight.performance_interpretation,
          performanceImpact: insight.performance_impact || [],
          balanceScore: insight.balance_score,
          symmetryScore: insight.symmetry_score,
          posturalEfficiency: insight.postural_efficiency,
          riskLevel: insight.risk_level,
          riskDescription: insight.risk_description,
          targetedRecommendations: insight.targeted_recommendations || [],
          postureMetrics: insight.posture_metrics,
        },
      };
    });

    // Process summaries sequentially with delays to avoid rate limits
    // Instead of Promise.all (parallel), process one at a time with 2-second delays
    const summaries: any[] = [];
    const participantEntries = Object.entries(insightsByParticipant);
    
    for (let i = 0; i < participantEntries.length; i++) {
      // Add delay between participants (except the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
      
      try {
        // Execute the promise for this participant
        const [participantId, insights] = participantEntries[i];
        const promise = summaryPromises[i];
        const result = await promise;
        summaries.push(result);
      } catch (error: any) {
        console.error(`[API] Failed to generate summary for participant:`, error);
        // Continue with next participant instead of failing entire request
      }
    }

    // Generate PDF for each summary
    const pdfBuffers: Buffer[] = [];
    try {
      for (const summaryResult of summaries) {
        try {
          const pdfBuffer = await generatePDF(summaryResult, dbSession);
          pdfBuffers.push(pdfBuffer);
        } catch (pdfError: any) {
          console.error(`[API] Error generating PDF for participant ${summaryResult.participantId}:`, pdfError);
          // Continue with other participants, but log the error
          throw new Error(`Failed to generate PDF: ${pdfError.message || 'Unknown error'}`);
        }
      }

      // If only one summary, return it directly as PDF
      // Otherwise, we could combine them or return the first one
      const pdfBuffer = pdfBuffers[0] || Buffer.alloc(0);

      if (pdfBuffer.length === 0) {
        return NextResponse.json(
          { error: 'Failed to generate PDF - no PDF data was created' },
          { status: 500 }
        );
      }

      // Return PDF as download
      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ai-insights-summary-${sessionId}-${Date.now()}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } catch (pdfGenError: any) {
      console.error('[API] Error during PDF generation:', pdfGenError);
      return NextResponse.json(
        { error: `PDF generation failed: ${pdfGenError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
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
      // Always use @sparticuz/chromium - it works in both local dev and serverless (Netlify, AWS Lambda)
      // The package automatically handles the differences between environments
      console.log('[PDF] Using @sparticuz/chromium for PDF generation');
      console.log('[PDF] Environment check:', {
        NODE_ENV: process.env.NODE_ENV,
        NETLIFY: process.env.NETLIFY,
        AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'set' : 'not set',
      });
      
      const executablePath = await chromium.executablePath();
      console.log('[PDF] Chromium executable path obtained:', executablePath ? 'Yes' : 'No');
      
      if (!executablePath) {
        throw new Error('Failed to get Chromium executable path from @sparticuz/chromium');
      }
      
      const browserOptions = {
        headless: chromium.headless,
        args: [
          ...chromium.args,
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--single-process', // Important for serverless environments
          '--disable-plugins',
          '--disable-extensions',
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath,
      };

      console.log('[PDF] Launching browser with options:', {
        headless: browserOptions.headless,
        hasExecutablePath: !!browserOptions.executablePath,
        executablePath: browserOptions.executablePath ? 
          (browserOptions.executablePath.length > 50 ? 
            browserOptions.executablePath.substring(0, 50) + '...' : 
            browserOptions.executablePath) : 
          'Not set',
        argsCount: browserOptions.args?.length || 0,
      });

      browser = await puppeteerCore.launch(browserOptions);
      
      const page = await browser.newPage();
      
      // Use 'load' instead of 'networkidle0' for faster rendering (saves ~5-10 seconds)
      // Set a shorter timeout for page content loading (10 seconds)
      await Promise.race([
        page.setContent(html, { waitUntil: 'load', timeout: 10000 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF generation timeout: page content loading exceeded 10 seconds')), 10000)
        )
      ]);
      
      // Set a shorter timeout for PDF generation (15 seconds)
      const pdfBuffer = await Promise.race([
        page.pdf({
          format: 'A4',
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm',
          },
          printBackground: true,
          timeout: 15000,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('PDF generation timeout: PDF creation exceeded 15 seconds')), 15000)
        )
      ]);
      
      await browser.close();
      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error('[PDF] Error during PDF generation:', error);
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[PDF] Error closing browser:', closeError);
        }
      }
      throw new Error(`PDF generation failed: ${error.message || 'Unknown error'}`);
    }
}

