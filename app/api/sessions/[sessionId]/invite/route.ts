import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSessionById } from '@/lib/dynamodb-schedules';
import { getSubjectProfile } from '@/lib/dynamodb-subjects';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { getUserProfile } from '@/lib/dynamodb';
import { generateICS } from '@/lib/icalendar';
import { createMultipartEmail } from '@/lib/email-utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || 'us-east-2',
  credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function POST(
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
    const { subjectIds } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json(
        { error: 'Subject IDs array is required' },
        { status: 400 }
      );
    }

    // Get the session
    const dbSession = await getSessionById(sessionId);
    
    if (!dbSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify that the current user is the coach (session owner)
    if (dbSession.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the coach can invite participants to this session' },
        { status: 403 }
      );
    }

    // Check if session is completed or cancelled
    if (dbSession.status === 'completed' || dbSession.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot invite participants to a completed or cancelled session' },
        { status: 400 }
      );
    }

    // Get coach information
    const coach = await getUserProfile(dbSession.user_id);
    const coachName = coach?.f_name && coach?.l_name 
      ? `${coach.f_name} ${coach.l_name}` 
      : coach?.fullName || session.user.name || 'Coach';

    // Get existing participants
    const existingSubjectIds: string[] = [];
    if (dbSession.subject_id) {
      existingSubjectIds.push(dbSession.subject_id);
    }
    if (dbSession.subject_ids && Array.isArray(dbSession.subject_ids)) {
      existingSubjectIds.push(...dbSession.subject_ids);
    }

    // Filter out participants that are already in the session
    const newSubjectIds = subjectIds.filter((id: string) => !existingSubjectIds.includes(id));

    if (newSubjectIds.length === 0) {
      return NextResponse.json(
        { error: 'All selected participants are already invited to this session' },
        { status: 400 }
      );
    }

    // Update session with new participants
    const updatedSubjectIds = [...existingSubjectIds, ...newSubjectIds];
    
    // Create DynamoDB client for updating
    const client = new DynamoDBClient({
      region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || 'us-east-2',
      credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
        ? {
            accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
    const docClient = DynamoDBDocumentClient.from(client);

    // Update session based on session type
    if (dbSession.session_type === 'single' || dbSession.session_type === 'mocap') {
      // For single/mocap sessions, we can't add multiple participants
      // But we can update if it's being converted or if there's only one new participant
      if (newSubjectIds.length > 1) {
        return NextResponse.json(
          { error: 'Cannot add multiple participants to a 1:1 session' },
          { status: 400 }
        );
      }
      // Update subject_id (this replaces the existing one)
      await docClient.send(
        new UpdateCommand({
          TableName: 'jak-coach-sessions-schedule',
          Key: {
            user_id: dbSession.user_id,
            session_date_time: dbSession.session_date_time,
          },
          UpdateExpression: 'SET subject_id = :subjectId, updated_at = :updatedAt',
          ExpressionAttributeValues: {
            ':subjectId': newSubjectIds[0],
            ':updatedAt': new Date().toISOString(),
          },
        })
      );
    } else {
      // For group sessions, update subject_ids array
      await docClient.send(
        new UpdateCommand({
          TableName: 'jak-coach-sessions-schedule',
          Key: {
            user_id: dbSession.user_id,
            session_date_time: dbSession.session_date_time,
          },
          UpdateExpression: 'SET subject_ids = :subjectIds, updated_at = :updatedAt',
          ExpressionAttributeValues: {
            ':subjectIds': updatedSubjectIds,
            ':updatedAt': new Date().toISOString(),
          },
        })
      );
    }

    // Format session date and time
    const sessionDate = new Date(dbSession.session_date_time);
    const formattedDate = sessionDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = sessionDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const sessionTypeText = dbSession.session_type === 'single' 
      ? 'Virtual 1:1 Session' 
      : dbSession.session_type === 'mocap' 
        ? 'In-Person 1:1 Motion Capture Session' 
        : 'Virtual Group Session';
    const isMocapSession = dbSession.session_type === 'mocap';
    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const sessionLink = `${baseUrl}/session/${dbSession.session_id}`;

    // Send invitation emails to new participants
    const emailResults = await Promise.allSettled(
      newSubjectIds.map(async (subjectId: string) => {
        try {
          // Get subject profile to get email address
          const subject = await getSubjectProfile(subjectId);
          if (!subject || !subject.email) {
            console.warn(`Subject ${subjectId} not found or has no email`);
            return { subjectId, success: false, error: 'Subject not found or no email' };
          }

          const memberName = subject.name || subject.full_name || subject.f_name || 'Member';

          // Create email content
          const emailSubject = `You've been invited to: ${dbSession.title}`;
          const emailBody = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #2563eb;">JAK Labs</h1>
                </div>
                
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <h2 style="color: #111827; margin-top: 0;">Session Invitation</h2>
                  <p style="margin-bottom: 10px;">Hi ${memberName},</p>
                  <p style="margin-bottom: 20px;">
                    ${coachName} has invited you to join a ${sessionTypeText.toLowerCase()}.
                  </p>
                  
                  <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <h3 style="margin-top: 0; color: #111827;">${dbSession.title}</h3>
                    <p style="margin: 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
                    <p style="margin: 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
                    <p style="margin: 8px 0;"><strong>Duration:</strong> ${dbSession.duration} minutes</p>
                    ${dbSession.session_type === 'group' ? `<p style="margin: 8px 0;"><strong>Type:</strong> Group Session</p>` : ''}
                    ${dbSession.notes ? `<p style="margin: 8px 0;"><strong>Notes:</strong> ${dbSession.notes}</p>` : ''}
                  </div>
                  
                  ${!isMocapSession ? `
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${sessionLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                      Join Session
                    </a>
                  </div>
                  ` : `
                  <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e;"><strong>Note:</strong> This is an in-person motion capture session.</p>
                  </div>
                  `}
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
                  <p>This invitation was sent by ${coachName} via JAK Labs.</p>
                </div>
              </body>
            </html>
          `;

          const textBody = `
Hi ${memberName},

${coachName} has invited you to join a ${sessionTypeText.toLowerCase()}.

Session Details:
- Title: ${dbSession.title}
- Date: ${formattedDate}
- Time: ${formattedTime}
- Duration: ${dbSession.duration} minutes
${dbSession.session_type === 'group' ? `- Type: Group Session\n` : ''}
${dbSession.notes ? `- Notes: ${dbSession.notes}\n` : ''}

${!isMocapSession ? `Join session: ${sessionLink}` : 'This is an in-person motion capture session.'}

This invitation was sent by ${coachName} via JAK Labs.
          `;

          const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@api.jak-labs.com';

          // Generate calendar invite for the session
          const sessionStartDate = new Date(dbSession.session_date_time);
          const sessionEndDate = new Date(sessionStartDate);
          sessionEndDate.setMinutes(sessionEndDate.getMinutes() + dbSession.duration);

          const calendarEvent = generateICS({
            summary: dbSession.title,
            description: `${sessionTypeText} with ${coachName}${dbSession.notes ? `\n\nNotes: ${dbSession.notes}` : ''}${!isMocapSession ? `\n\nJoin session: ${sessionLink}` : '\n\nThis is an in-person session.'}`,
            startDate: sessionStartDate,
            endDate: sessionEndDate,
            location: isMocapSession ? 'JAK Labs Motion Capture Studio' : 'JAK Labs Video Session',
            organizer: {
              name: coachName,
              email: session.user.email || fromEmail,
            },
            attendee: {
              name: memberName,
              email: subject.email,
            },
            url: !isMocapSession ? sessionLink : undefined,
          });

          // Create multipart email with calendar attachment
          const rawEmail = createMultipartEmail(
            fromEmail,
            subject.email,
            emailSubject,
            emailBody,
            textBody,
            calendarEvent,
            `jak-labs-session-${dbSession.session_id}.ics`
          );

          await sesClient.send(
            new SendRawEmailCommand({
              RawMessage: {
                Data: rawEmail,
              },
            })
          );

          return { subjectId, success: true, email: subject.email };
        } catch (error: any) {
          console.error(`Error sending email to subject ${subjectId}:`, error);
          return { subjectId, success: false, error: error.message };
        }
      })
    );

    // Log email results
    const successful = emailResults.filter((r) => r.status === 'fulfilled' && r.value && r.value.success);
    const failed = emailResults.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && !r.value.success));

    console.log(`[API] Invited ${successful.length} participant(s) to session ${sessionId}`);
    if (failed.length > 0) {
      console.warn(`[API] Failed to send ${failed.length} invitation email(s)`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully invited ${successful.length} participant(s)`,
      invited: successful.length,
      failed: failed.length,
      results: emailResults.map((r) => 
        r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }
      ),
    });
  } catch (error: any) {
    console.error('[API] Error inviting participants to session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to invite participants' },
      { status: 500 }
    );
  }
}

