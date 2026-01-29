# Environment Variables for Netlify and Amplify

This document lists all required environment variables for Netlify and AWS Amplify.

## How to Set Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable** for each variable below
5. Add the variable name and value
6. Click **Save**

## How to Set Environment Variables in Amplify

1. Go to the AWS Amplify Console
2. Select your app and branch
3. Go to **App settings** → **Environment variables**
4. Click **Add variable** for each variable below
5. Add the variable name and value
6. Click **Save** and trigger a new build

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

**Netlify:** Netlify reserves `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` for its own use. Use the `JAK_` prefixed versions instead:

```env
JAK_AWS_REGION=us-east-2
JAK_AWS_ACCESS_KEY_ID=your_aws_access_key_id
JAK_AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

**Amplify:** You can use either the standard `AWS_*` variables or the `JAK_AWS_*` variables (both are supported by the code).

**Note:**
- These credentials need permissions for:
  - DynamoDB (read/write access to your tables)
  - Cognito (AdminListGroupsForUser, AdminAddUserToGroup, AdminGetUser)
  - SES (SendEmail)
- The code will use `AWS_*` or `JAK_AWS_*` if present (Netlify should use `JAK_AWS_*`)

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

### S3 Bucket for Session Videos

```env
S3_BUCKET_NAME=jak-mpc-recorded-sessions-subjects-only
```

## Complete Example

Here's a complete example of all variables (with placeholder values):

```env
# Cognito
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
COGNITO_ISSUER=https://cognito-idp.us-east-2.amazonaws.com/us-east-2_AbCdEfGhI

# NextAuth
NEXTAUTH_SECRET=your-super-secret-key-min-32-characters-long
NEXTAUTH_URL=https://your-app-name.netlify.app

# AWS (Netlify uses JAK_ prefix, Amplify can use AWS_* or JAK_*)
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

# S3 Bucket for Subject-Only Session Videos
S3_BUCKET_NAME=jak-mpc-recorded-sessions-subjects-only
```

## Security Notes

1. **Never commit** `.env.local` or `.env` files to git
2. All these variables are **sensitive** - keep them secure
3. Use encrypted environment variables in your hosting provider
4. Consider environment variable scoping if available

## Testing

After setting the variables:
1. Trigger a new deployment in Netlify or Amplify
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

