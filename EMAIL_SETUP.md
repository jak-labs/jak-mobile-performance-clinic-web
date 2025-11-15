# Email Setup for Client Invitations

## AWS SES Configuration

The application uses AWS SES (Simple Email Service) to send client invitation emails.

### Environment Variables

Add these to your `.env.local`:

```env
# AWS SES Configuration
SES_FROM_EMAIL=noreply@yourdomain.com
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### AWS SES Setup Steps

1. **Verify Your Email Domain or Email Address**:
   - Go to AWS SES Console
   - Navigate to "Verified identities"
   - Click "Create identity"
   - Choose "Email address" or "Domain" (recommended for production)
   - Follow the verification steps

2. **Move Out of SES Sandbox** (if needed):
   - By default, SES is in sandbox mode
   - You can only send to verified email addresses in sandbox mode
   - To send to any email, request production access:
     - Go to SES Console → Account dashboard
     - Click "Request production access"
     - Fill out the form and wait for approval

3. **IAM Permissions**:
   Your AWS credentials need the following SES permissions:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ses:SendEmail",
           "ses:SendRawEmail"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

### Alternative: Using Resend or SendGrid

If you prefer not to use AWS SES, you can modify `/app/api/clients/invite/route.ts` to use:
- **Resend**: `npm install resend`
- **SendGrid**: `npm install @sendgrid/mail`
- **Nodemailer**: `npm install nodemailer`

### Email Template

The invitation email includes:
- Personalized greeting with client name
- Clear call-to-action button
- Signup link with invite token
- Professional HTML formatting
- Plain text fallback

### Invite Flow

1. Coach adds client → Client saved to DynamoDB with `pending_invite` status
2. Invite email sent with unique token
3. Client clicks link → Redirected to sign-up with email pre-filled
4. Client signs up → Account created in Cognito as "Member"
5. Email verification → Subject profile updated with real `subject_id` and `active` status

### Testing

For development/testing, you can:
1. Use SES sandbox mode (only verified emails)
2. Check email logs in AWS SES Console
3. Monitor DynamoDB for invite tokens and status updates

