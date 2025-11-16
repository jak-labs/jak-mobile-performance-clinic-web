import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { saveSubjectProfile } from '@/lib/dynamodb-subjects';
import { randomUUID } from 'crypto';

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
    // Get authenticated user (coach)
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { name, email, sportType, notes } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Parse name into first and last name
    const nameParts = name.trim().split(' ');
    const f_name = nameParts[0] || '';
    const l_name = nameParts.slice(1).join(' ') || '';

    // Generate invite token
    const inviteToken = randomUUID();
    const signupUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/sign-up?invite=${inviteToken}&email=${encodeURIComponent(email)}`;

    // Save client/subject to DynamoDB with pending status
    // We'll use a temporary subject_id until they sign up
    const tempSubjectId = `pending-${inviteToken}`;
    
    try {
      await saveSubjectProfile({
        subject_id: tempSubjectId,
        email,
        name: name,
        full_name: name,
        f_name: f_name || undefined,
        l_name: l_name || undefined,
        // Store invite token and coach info
        invite_token: inviteToken,
        coach_id: session.user.id,
        owner_id: session.user.id, // Required partition key for jak-subjects table
        sport: sportType || undefined,
        notes: notes || undefined,
        status: 'pending_invite',
      });
    } catch (dbError: any) {
      console.error('Error saving client to DynamoDB:', dbError);
      // Continue even if DB save fails - we'll still send the invite
    }

        // Send invite email
        const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@api.jak-labs.com';
    const emailSubject = 'You\'ve been invited to join JAK Labs';
    
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
            <h2 style="color: #111827; margin-top: 0;">You've been invited!</h2>
            <p style="margin-bottom: 10px;">Hi ${name},</p>
            <p style="margin-bottom: 10px;">
              Your coach has invited you to join JAK Labs, a platform for athlete performance monitoring and coaching.
            </p>
            <p style="margin-bottom: 20px;">
              Click the button below to create your account and get started:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signupUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Accept Invitation & Sign Up
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              Or copy and paste this link into your browser:<br>
              <a href="${signupUrl}" style="color: #2563eb; word-break: break-all;">${signupUrl}</a>
            </p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
Hi ${name},

Your coach has invited you to join JAK Labs, a platform for athlete performance monitoring and coaching.

Click the link below to create your account and get started:

${signupUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
    `;

    try {
      await sesClient.send(
        new SendEmailCommand({
          Source: fromEmail,
          Destination: {
            ToAddresses: [email],
          },
          Message: {
            Subject: {
              Data: emailSubject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: emailBody,
                Charset: 'UTF-8',
              },
              Text: {
                Data: textBody,
                Charset: 'UTF-8',
              },
            },
          },
        })
      );

      return NextResponse.json(
        {
          message: 'Client added and invitation email sent successfully',
          inviteToken,
        },
        { status: 201 }
      );
    } catch (emailError: any) {
      console.error('Error sending invite email:', emailError);
      
      // Still return success if email fails - client is saved to DB
      // Check if it's a sandbox mode error
      if (emailError.name === 'MessageRejected' && emailError.message?.includes('not verified')) {
        return NextResponse.json(
          {
            message: 'Client added successfully, but invitation email could not be sent',
            warning: 'Email address is not verified in SES. Please verify the recipient email in SES Console or request production access.',
            error: 'SES Sandbox Mode: Email address must be verified',
            inviteToken,
            signupUrl,
          },
          { status: 201 }
        );
      }
      
      return NextResponse.json(
        {
          message: 'Client added successfully, but invitation email could not be sent',
          warning: 'Please send the invitation manually',
          error: emailError.message || 'Unknown error',
          inviteToken,
          signupUrl,
        },
        { status: 201 }
      );
    }
  } catch (error: any) {
    console.error('Error adding client:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add client' },
      { status: 500 }
    );
  }
}

