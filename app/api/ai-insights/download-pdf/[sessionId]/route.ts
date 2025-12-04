import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById } from '@/lib/dynamodb-schedules';
import { getAllAIInsightsForSession } from '@/lib/dynamodb-ai-insights';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

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
    insight?: {
      movementQuality?: string;
      movementPatterns?: string[];
      movementConsistency?: number;
      dynamicStability?: number;
      performanceInterpretation?: string;
      performanceImpact?: string[];
      postureMetrics?: any;
    };
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
  <h1>AI Movement Summary – ${summaryResult.participantName}</h1>
  
  <div class="info">
    <p><strong>Session:</strong> ${session.title || session.session_id}</p>
    <p><strong>Date:</strong> ${new Date(session.session_date_time).toLocaleDateString()}</p>
  </div>

  ${summaryResult.insight?.movementQuality || (summaryResult.insight?.movementPatterns && summaryResult.insight.movementPatterns.length > 0) ? `
  <h2>Movement Analysis</h2>
  ${summaryResult.insight.movementQuality ? `
  <p><strong>Movement Quality:</strong> ${summaryResult.insight.movementQuality}</p>
  ` : ''}
  ${summaryResult.insight.movementPatterns && summaryResult.insight.movementPatterns.length > 0 ? `
  <p><strong>Movement Patterns:</strong></p>
  <ul>
    ${summaryResult.insight.movementPatterns.map((pattern: string) => `<li>${pattern}</li>`).join('')}
  </ul>
  ` : ''}
  ` : ''}

  ${summaryResult.insight?.postureMetrics ? `
  <h2>Posture Metrics</h2>
  <div class="text-content">
    ${summaryResult.insight.postureMetrics.spine_lean ? `<p><strong>Spine Lean:</strong> ${summaryResult.insight.postureMetrics.spine_lean}</p>` : ''}
    ${summaryResult.insight.postureMetrics.neck_flexion ? `<p><strong>Neck Flexion:</strong> ${summaryResult.insight.postureMetrics.neck_flexion}</p>` : ''}
    ${summaryResult.insight.postureMetrics.shoulder_alignment ? `<p><strong>Shoulder Alignment:</strong> ${summaryResult.insight.postureMetrics.shoulder_alignment}</p>` : ''}
    ${summaryResult.insight.postureMetrics.pelvic_sway ? `<p><strong>Pelvic Sway:</strong> ${summaryResult.insight.postureMetrics.pelvic_sway}</p>` : ''}
    ${summaryResult.insight.postureMetrics.additional_metrics && summaryResult.insight.postureMetrics.additional_metrics.length > 0 ? `
    ${summaryResult.insight.postureMetrics.additional_metrics.map((metric: string) => `<p>${metric}</p>`).join('')}
    ` : ''}
  </div>
  ` : ''}

  ${summaryResult.insight?.performanceInterpretation ? `
  <h2>Performance Interpretation</h2>
  <div class="text-content">
    ${summaryResult.insight.performanceInterpretation}
  </div>
  ` : ''}

  ${summaryResult.insight?.performanceImpact && summaryResult.insight.performanceImpact.length > 0 ? `
  <h2>Performance Impact</h2>
  <ul>
    ${summaryResult.insight.performanceImpact.map((impact: string) => `<li>${impact}</li>`).join('')}
  </ul>
  ` : ''}

  <h2>Scores</h2>
  <div class="metrics">
    <div class="metric-item">
      <div class="metric-label">Balance Score</div>
      <div class="metric-value">${summaryResult.metrics.average_balance_score.toFixed(0)}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Symmetry</div>
      <div class="metric-value">${summaryResult.metrics.average_symmetry_score.toFixed(0)}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Postural Efficiency</div>
      <div class="metric-value">${summaryResult.metrics.average_postural_efficiency?.toFixed(0) || 'N/A'}</div>
    </div>
    ${summaryResult.insight?.movementConsistency !== undefined ? `
    <div class="metric-item">
      <div class="metric-label">Movement Consistency</div>
      <div class="metric-value">${summaryResult.insight.movementConsistency.toFixed(0)}</div>
    </div>
    ` : ''}
    ${summaryResult.insight?.dynamicStability !== undefined ? `
    <div class="metric-item">
      <div class="metric-label">Dynamic Stability</div>
      <div class="metric-value">${summaryResult.insight.dynamicStability.toFixed(0)}</div>
    </div>
    ` : ''}
  </div>

  ${summaryResult.metrics.risk_level ? `
  <h2>Risk Level</h2>
  <div class="text-content">
    <p><strong>${summaryResult.metrics.risk_level}</strong></p>
    ${summaryResult.summary.key_findings && summaryResult.summary.key_findings.some((f: string) => f.includes('risk') || f.includes('Risk')) ? `
    <p>${summaryResult.summary.key_findings.find((f: string) => f.includes('risk') || f.includes('Risk')) || ''}</p>
    ` : ''}
  </div>
  ` : ''}

  ${summaryResult.summary.recommendations && summaryResult.summary.recommendations.length > 0 ? `
  <h2>Targeted Recommendations</h2>
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
    console.log('[PDF] Using @sparticuz/chromium for PDF generation');
    
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
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

    // Get all insights for this session (should be 1 per participant)
    const insights = await getAllAIInsightsForSession(sessionId);
    
    if (insights.length === 0) {
      return NextResponse.json(
        { error: 'No insights found for this session. Please generate insights first using "Generate Session Insights".' },
        { status: 404 }
      );
    }

    // Generate PDF for the first insight (or combine multiple if needed)
    // For now, we'll generate PDF for the first participant
    const firstInsight = insights[0];
    
    // Convert insight to summary format for PDF generation
    const summaryResult = {
      participantId: firstInsight.participant_id,
      participantName: firstInsight.participant_name || firstInsight.participant_id,
      summaryId: firstInsight.insight_id,
      summary: {
        summary: firstInsight.performance_interpretation || 'No summary available',
        key_findings: [
          firstInsight.movement_quality ? `Movement Quality: ${firstInsight.movement_quality}` : null,
          ...(firstInsight.movement_patterns || []),
          firstInsight.risk_description || null,
        ].filter(Boolean) as string[],
        recommendations: firstInsight.targeted_recommendations || [],
        overall_assessment: firstInsight.performance_interpretation || 'No assessment available',
      },
      metrics: {
        average_balance_score: firstInsight.balance_score || 0,
        average_symmetry_score: firstInsight.symmetry_score || 0,
        average_postural_efficiency: firstInsight.postural_efficiency || 0,
        risk_level: firstInsight.risk_level || 'Low',
      },
      // Include insight data for PDF
      insight: {
        movementQuality: firstInsight.movement_quality,
        movementPatterns: firstInsight.movement_patterns || [],
        movementConsistency: firstInsight.movement_consistency,
        dynamicStability: firstInsight.dynamic_stability,
        performanceInterpretation: firstInsight.performance_interpretation,
        performanceImpact: firstInsight.performance_impact || [],
        postureMetrics: firstInsight.posture_metrics,
      },
    };

    const pdfBuffer = await generatePDF(summaryResult, dbSession);

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
  } catch (error: any) {
    console.error('[API] Error downloading PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to download PDF' },
      { status: 500 }
    );
  }
}

