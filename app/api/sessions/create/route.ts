import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSession } from '@/lib/dynamodb-schedules';
import { getSubjectProfile } from '@/lib/dynamodb-subjects';
import { getUserProfile } from '@/lib/dynamodb';
import { randomUUID } from 'crypto';
import { RoomServiceClient } from 'livekit-server-sdk';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { generateICS } from '@/lib/icalendar';
import { createMultipartEmail } from '@/lib/email-utils';

// Initialize SES client
// Use JAK_ prefixed vars for Netlify (AWS_* are reserved), fallback to AWS_* for local dev
const sesClient = new SESClient({
  region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || 'us-east-2',
  credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    ? {
        accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();

    const { title, date, time, duration, sessionType, subjectIds, notes } = body;

    // Validate required fields
    if (!title || !date || !time || !duration || !sessionType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate subject selection
    if (!subjectIds || subjectIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one client must be selected' },
        { status: 400 }
      );
    }

    // Validate session type matches selection
    if (sessionType === 'single' && subjectIds.length !== 1) {
      return NextResponse.json(
        { error: '1:1 sessions must have exactly one client' },
        { status: 400 }
      );
    }

    if (sessionType === 'group' && subjectIds.length < 2) {
      return NextResponse.json(
        { error: 'Group sessions must have at least two clients' },
        { status: 400 }
      );
    }

    // Parse date and time to create ISO 8601 datetime string
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const sessionDateTime = new Date(year, month - 1, day, hours, minutes).toISOString();

    // Generate unique session ID
    const sessionId = randomUUID();

    // Create LiveKit room for this session
    let livekitRoomName = `session-${sessionId}`;
    try {
      const livekitUrl = process.env.LIVEKIT_URL;
      const livekitApiKey = process.env.LIVEKIT_API_KEY;
      const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

      if (livekitUrl && livekitApiKey && livekitApiSecret) {
        const roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
        const room = await roomService.createRoom({
          name: livekitRoomName,
          emptyTimeout: 10 * 60, // 10 minutes
          maxParticipants: 20,
        });
        livekitRoomName = room.name;
      }
    } catch (error: any) {
      // If room already exists or creation fails, continue with the room name
      console.warn('LiveKit room creation warning:', error.message);
      // Room might already exist, which is fine
    }

    // Prepare session data
    // sessionType is already converted to "single" or "group" from frontend
    const sessionData: any = {
      user_id: userId,
      session_date_time: sessionDateTime,
      session_id: sessionId,
      session_type: sessionType, // Already "single" or "group"
      title,
      duration: parseInt(duration, 10),
      notes: notes || undefined,
      status: 'scheduled',
      livekit_room_name: livekitRoomName,
    };

    // Add subject_id for single sessions, subject_ids for group sessions
    if (sessionType === 'single') {
      sessionData.subject_id = subjectIds[0];
    } else {
      sessionData.subject_ids = subjectIds;
    }

    // Create session in DynamoDB
    await createSession(sessionData);

    // Send email notifications to all members in the session
    // Remove trailing slash from NEXTAUTH_URL to avoid double slashes
    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const sessionLink = `${baseUrl}/session/${sessionId}`;
    const sessionDate = new Date(sessionDateTime);
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

    // Get coach information for email
    let coachName = 'Your coach';
    try {
      const coachProfile = await getUserProfile(userId);
      if (coachProfile?.fullName) {
        coachName = coachProfile.fullName;
      }
    } catch (error) {
      console.error('Error fetching coach profile for email:', error);
    }

    // Get all subject IDs (handle both single and group sessions)
    const allSubjectIds = sessionType === 'single' ? [subjectIds[0]] : subjectIds;

    // Send emails to all members
    const emailResults = await Promise.allSettled(
      allSubjectIds.map(async (subjectId: string) => {
        try {
          // Get subject profile to get email address
          const subject = await getSubjectProfile(subjectId);
          if (!subject || !subject.email) {
            console.warn(`Subject ${subjectId} not found or has no email`);
            return { subjectId, success: false, error: 'Subject not found or no email' };
          }

          const memberName = subject.name || subject.full_name || subject.f_name || 'Member';
          const sessionTypeText = sessionType === 'single' ? '1:1 Session' : 'Group Session';

          // Create email content
          const emailSubject = `New ${sessionTypeText} Scheduled: ${title}`;
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
                  <h2 style="color: #111827; margin-top: 0;">New Session Scheduled</h2>
                  <p style="margin-bottom: 10px;">Hi ${memberName},</p>
                  <p style="margin-bottom: 20px;">
                    ${coachName} has scheduled a new ${sessionTypeText.toLowerCase()} for you.
                  </p>
                  
                  <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <h3 style="margin-top: 0; color: #111827;">${title}</h3>
                    <p style="margin: 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
                    <p style="margin: 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
                    <p style="margin: 8px 0;"><strong>Duration:</strong> ${duration} minutes</p>
                    ${sessionType === 'group' ? `<p style="margin: 8px 0;"><strong>Type:</strong> Group Session</p>` : ''}
                    ${notes ? `<p style="margin: 8px 0;"><strong>Notes:</strong> ${notes}</p>` : ''}
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${sessionLink}" 
                       style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                      Join Session
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="${sessionLink}" style="color: #2563eb; word-break: break-all;">${sessionLink}</a>
                  </p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                  <p>This session is scheduled for ${formattedDate} at ${formattedTime}.</p>
                  <p>You can access the session using the link above when it's time.</p>
                </div>
              </body>
            </html>
          `;

          const textBody = `
Hi ${memberName},

${coachName} has scheduled a new ${sessionTypeText.toLowerCase()} for you.

Session Details:
- Title: ${title}
- Date: ${formattedDate}
- Time: ${formattedTime}
- Duration: ${duration} minutes
${notes ? `- Notes: ${notes}` : ''}

Join the session at: ${sessionLink}

This session is scheduled for ${formattedDate} at ${formattedTime}. You can access the session using the link above when it's time.
          `;

          const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@api.jak-labs.com';

          // Generate calendar invite for the session
          const sessionStartDate = new Date(sessionDateTime);
          const sessionEndDate = new Date(sessionStartDate);
          sessionEndDate.setMinutes(sessionEndDate.getMinutes() + duration);

          const calendarEvent = generateICS({
            summary: title,
            description: `${sessionTypeText} with ${coachName}${notes ? `\n\nNotes: ${notes}` : ''}\n\nJoin session: ${sessionLink}`,
            startDate: sessionStartDate,
            endDate: sessionEndDate,
            location: 'JAK Labs Video Session',
            organizer: {
              name: coachName,
              email: session.user.email || fromEmail,
            },
            attendee: {
              name: memberName,
              email: subject.email,
            },
            url: sessionLink,
          });

          // Create multipart email with calendar attachment
          const rawEmail = createMultipartEmail(
            fromEmail,
            subject.email,
            emailSubject,
            emailBody,
            textBody,
            calendarEvent,
            `jak-labs-session-${sessionId}.ics`
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
    const failed = emailResults.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && (!r.value || !r.value.success)));

    if (failed.length > 0) {
      console.warn(`Failed to send ${failed.length} email(s) out of ${emailResults.length}`);
    }

    return NextResponse.json(
      {
        message: 'Session created successfully',
        session_id: sessionId,
        emails_sent: successful.length,
        emails_failed: failed.length,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}

