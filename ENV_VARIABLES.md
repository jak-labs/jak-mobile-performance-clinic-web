# Environment Variables for Netlify Deployment

This document lists all required environment variables that need to be set in your Netlify dashboard.

## How to Set Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable** for each variable below
5. Add the variable name and value
6. Click **Save**

## Required Environment Variables

### AWS Cognito Authentication

```env
COGNITO_CLIENT_ID=your_cognito_client_id
COGNITO_ISSUER=https://cognito-idp.{region}.amazonaws.com/{userPoolId}
```

**Example:**
```
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
COGNITO_ISSUER=https://cognito-idp.us-east-2.amazonaws.com/us-east-2_AbCdEfGhI
```

### NextAuth Configuration

```env
NEXTAUTH_SECRET=your_random_secret_key_here
NEXTAUTH_URL=https://your-site.netlify.app
```

**Note:** 
- `NEXTAUTH_SECRET` should be a long, random string (you can generate one with `openssl rand -base64 32`)
- `NEXTAUTH_URL` should be your Netlify site URL (e.g., `https://your-app-name.netlify.app`)

### AWS Credentials

**⚠️ IMPORTANT:** Netlify reserves `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` for its own use. Use the `JAK_` prefixed versions instead:

```env
JAK_AWS_REGION=us-east-2
JAK_AWS_ACCESS_KEY_ID=your_aws_access_key_id
JAK_AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

**Note:** 
- These credentials need permissions for:
  - DynamoDB (read/write access to your tables)
  - Cognito (AdminListGroupsForUser, AdminAddUserToGroup, AdminGetUser)
  - SES (SendEmail)
- The code will fallback to `AWS_*` variables for local development, but use `JAK_AWS_*` in Netlify

### DynamoDB Tables

**Note:** Table names are now hardcoded in the application:
- `jak-users`
- `jak-subjects`
- `jak-coach-sessions-schedule`

No environment variables needed for table names.

### AWS SES (Email Sending)

```env
SES_FROM_EMAIL=noreply@api.jak-labs.com
```

**Note:** This email must be from a verified domain in AWS SES.

### LiveKit (Video Sessions)

```env
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.com
```

**Note:** 
- `LIVEKIT_URL` and `LIVEKIT_API_SECRET` are server-side only
- `NEXT_PUBLIC_LIVEKIT_URL` is exposed to the client

## Complete Example

Here's a complete example of all variables (with placeholder values):

```env
# Cognito
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
COGNITO_ISSUER=https://cognito-idp.us-east-2.amazonaws.com/us-east-2_AbCdEfGhI

# NextAuth
NEXTAUTH_SECRET=your-super-secret-key-min-32-characters-long
NEXTAUTH_URL=https://your-app-name.netlify.app

# AWS (use JAK_ prefix for Netlify - AWS_* are reserved)
JAK_AWS_REGION=us-east-2
JAK_AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
JAK_AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Note: DynamoDB table names are hardcoded (jak-users, jak-subjects, jak-coach-sessions-schedule)

# SES
SES_FROM_EMAIL=noreply@api.jak-labs.com

# LiveKit
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.com
```

## Security Notes

1. **Never commit** `.env.local` or `.env` files to git
2. All these variables are **sensitive** - keep them secure
3. Use Netlify's **encrypted environment variables** feature
4. Consider using **Netlify's environment variable scoping** (Build-time vs Runtime)

## Testing

After setting the variables:
1. Trigger a new deployment in Netlify
2. Check the build logs to ensure the build succeeds
3. Test the application functionality:
   - Sign up / Sign in
   - Create sessions
   - Send emails
   - Video sessions

## Troubleshooting

If you get errors about missing environment variables:
1. Double-check variable names (case-sensitive!)
2. Ensure no extra spaces in values
3. Verify AWS credentials have correct permissions
4. Check that Cognito User Pool and DynamoDB tables exist
5. Ensure SES is out of sandbox mode (or verify recipient emails)

