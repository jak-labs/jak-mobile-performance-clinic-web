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
   
   **For Domain Verification - DKIM Configuration:**
   - When verifying a domain, AWS will ask you to configure DKIM
   - **Choose "Easy DKIM"** (recommended for most users)
     - AWS automatically generates and manages DKIM keys
     - You'll need to add 3 CNAME records to your domain's DNS
     - AWS provides the exact records to add
   - **Alternative: "Bring Your Own DKIM (BYODKIM)"** (advanced)
     - Only choose this if you already have DKIM keys configured
     - Requires manual key management
   
   **Steps for Easy DKIM:**
   1. Select "Easy DKIM" when prompted
   2. **DKIM signatures**: Enable this (recommended)
      - Improves email deliverability and prevents spam filtering
      - This is separate from the DNS records - it enables DKIM signing
   3. **Publish DNS records to Route53**: 
      - ✅ **Enable if** your domain has a hosted zone in Route53 (even if domain is registered elsewhere)
      - ✅ **Enable if** your domain is registered in Route53
      - ❌ **Disable if** your domain DNS is managed elsewhere (GoDaddy, Cloudflare, Namecheap, etc.) and you don't have a Route53 hosted zone
      - If enabled, AWS will automatically add the CNAME records to your Route53 hosted zone
      - If disabled, you'll need to manually add the CNAME records to your DNS provider
   4. AWS will generate 3 CNAME records
   5. If Route53 publishing is disabled, copy these records and add them to your domain's DNS settings
   6. Wait for DNS propagation (usually 5-30 minutes)
   7. AWS will automatically verify once DNS records are detected
   
   **After Setup - Checking DKIM Status:**
   - In the SES console, go to your domain identity
   - Check the "DKIM configuration" status:
     - **Pending**: DNS records are being verified (wait 5-30 minutes)
     - **Success**: DKIM is fully configured ✅
     - **Failed**: Check that DNS records are correctly added
   - Click "Publish DNS records" to expand and view the CNAME records
   - If using Route53 and records aren't showing, check your hosted zone for the records
   - If status stays "Pending" for more than 30 minutes, verify the DNS records manually

   **Custom MAIL FROM Domain (Optional but Recommended):**
   - **What it does**: Makes emails appear to come from your domain instead of `amazonses.com`
   - **Benefits**:
     - Better email deliverability and reputation
     - DMARC compliance (required for some email providers)
     - Professional branding
   - **Setup**:
     - Enable "Use a custom MAIL FROM domain"
     - Enter a **subdomain** (e.g., `mail.api.jak-labs.com` or `email.api.jak-labs.com`)
       - ⚠️ **NOT an email address** - this is a domain/subdomain, not `no-reply@...`
     - Add MX and SPF records to your DNS (AWS provides these)
     - If using Route53, enable "Publish DNS records to Route53" to auto-add them
   - **Recommendation**: Set this up for production use, but it's not required for basic functionality
   
   **From Email Address (Separate Setting):**
   - This is the email address that appears in the "From" field of emails
   - Set in your `.env.local` as `SES_FROM_EMAIL`
   - **Recommended options**:
     - `noreply@api.jak-labs.com` ✅ (most common, prevents replies)
     - `no-reply@api.jak-labs.com` ✅ (alternative spelling)
     - `notifications@api.jak-labs.com` ✅ (if you want to allow replies)
   - **Note**: The email address must be from your verified domain (`api.jak-labs.com`)

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

**Step-by-Step Testing Guide:**

1. **Verify Your Environment Variables**:
   ```env
   SES_FROM_EMAIL=noreply@api.jak-labs.com
   AWS_REGION=us-east-2
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   ```

2. **Check SES Sandbox Status**:
   - If you're in sandbox mode, you can only send to verified email addresses
   - Go to SES Console → Verified identities
   - Verify your test email address (e.g., `your-test-email@gmail.com`)
   - Or request production access to send to any email

3. **Test via Application UI**:
   - Sign in as a coach
   - Navigate to "Clients" page
   - Click "Add Client"
   - Fill in:
     - Full Name: Test Client
     - Email: Your verified test email (or any email if in production mode)
     - Sport Type: (optional)
     - Notes: (optional)
   - Click "Add Client"
   - You should see: "Client added successfully! Invitation email has been sent."

4. **Check Your Email**:
   - Check the inbox of the email address you used
   - Check spam/junk folder if not in inbox
   - You should receive an email with:
     - Subject: "You've been invited to join JAK Labs"
     - From: `noreply@api.jak-labs.com`
     - A signup link with invite token

5. **Test the Invite Link**:
   - Click the "Accept Invitation & Sign Up" button in the email
   - Should redirect to sign-up page with email pre-filled
   - Complete signup form
   - Verify email with confirmation code
   - Should create account as "Member"

6. **Check AWS SES Console**:
   - Go to SES Console → Email sending → Sending statistics
   - Check for sent emails
   - Go to Configuration sets → (if configured) → Event publishing
   - View email delivery events

7. **Check Application Logs**:
   - Check your Next.js server console for any errors
   - Look for "Error sending invite email" messages if emails fail

8. **Verify DynamoDB**:
   - Check `jak-subjects` table for the new client entry
   - Should have `status: 'pending_invite'` initially
   - After signup, should have `status: 'active'` with real `subject_id`

**Troubleshooting:**
- If email not received: Check spam folder, verify SES sandbox mode, check SES sending statistics
- If error in console: Check AWS credentials, verify domain in SES, check IAM permissions
- If invite link doesn't work: Check that invite token is in URL, verify DynamoDB entry exists

