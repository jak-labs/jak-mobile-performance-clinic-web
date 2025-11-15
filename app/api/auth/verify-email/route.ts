import { NextRequest, NextResponse } from 'next/server';
import { CognitoUserPool, CognitoUser } from 'amazon-cognito-identity-js';
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { saveUserProfile } from '@/lib/dynamodb';
import { saveSubjectProfile } from '@/lib/dynamodb-subjects';

if (!process.env.COGNITO_CLIENT_ID || !process.env.COGNITO_ISSUER) {
  throw new Error('Missing required environment variables for Cognito authentication');
}

// Extract UserPoolId from COGNITO_ISSUER
const userPoolId = process.env.COGNITO_ISSUER.split('/').pop();
if (!userPoolId) {
  throw new Error('Invalid COGNITO_ISSUER format');
}

const poolData = {
  UserPoolId: userPoolId,
  ClientId: process.env.COGNITO_CLIENT_ID
};

const userPool = new CognitoUserPool(poolData);

// Initialize Cognito Identity Provider client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function POST(req: NextRequest) {
  try {
    const { email, code, fullName } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and confirmation code are required' },
        { status: 400 }
      );
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { error: 'Confirmation code must be 6 digits' },
        { status: 400 }
      );
    }

    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.confirmRegistration(code, true, async (err, result) => {
        if (err) {
          console.error('Cognito confirmation error:', err);
          resolve(
            NextResponse.json(
              { error: err.message || 'Failed to verify email' },
              { status: 400 }
            )
          );
          return;
        }

        // Get user's groups to determine if they're a Coach or Member
        try {
          const userPoolId = process.env.COGNITO_ISSUER?.split('/').pop();
          if (!userPoolId) {
            throw new Error('Invalid COGNITO_ISSUER format');
          }

          // Get user's groups
          const groupsResponse = await cognitoClient.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: userPoolId,
              Username: email,
            })
          );

          const groups = groupsResponse.Groups || [];
          const isMember = groups.some((g) => g.GroupName === 'Member');
          const isCoach = groups.some((g) => g.GroupName === 'Coach');

          // Get user attributes including sub
          const userResponse = await cognitoClient.send(
            new AdminGetUserCommand({
              UserPoolId: userPoolId,
              Username: email,
            })
          );

          // Get sub from user attributes
          const subAttribute = userResponse.UserAttributes?.find((attr) => attr.Name === 'sub');
          const userId = subAttribute?.Value || email;

          // Save to appropriate DynamoDB table based on group
          if (isMember) {
            // Parse fullName into f_name and l_name if provided
            const nameParts = fullName ? fullName.split(' ') : [];
            const f_name = nameParts[0] || '';
            const l_name = nameParts.slice(1).join(' ') || '';

            await saveSubjectProfile({
              subject_id: userId,
              email,
              name: fullName,
              full_name: fullName,
              f_name: f_name || undefined,
              l_name: l_name || undefined,
            });
          } else if (isCoach) {
            await saveUserProfile({
              userId: userId,
              email,
              fullName: fullName || undefined,
            });
          }

          resolve(
            NextResponse.json(
              {
                message: 'Email verified successfully',
                verified: true,
              },
              { status: 200 }
            )
          );
        } catch (dbError: any) {
          console.error('Error saving user profile after verification:', dbError);
          // Still return success since email verification succeeded
          resolve(
            NextResponse.json(
              {
                message: 'Email verified successfully',
                verified: true,
                warning: 'User profile could not be saved to database. Please contact support.',
              },
              { status: 200 }
            )
          );
        }
      });
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error occurred' },
      { status: 500 }
    );
  }
}

