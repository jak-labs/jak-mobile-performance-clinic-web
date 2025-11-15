import { NextRequest, NextResponse } from 'next/server';
import { CognitoUserPool, CognitoUserAttribute } from 'amazon-cognito-identity-js';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getSubjectByInviteToken, migratePendingSubjectToActive } from '@/lib/dynamodb-subjects';

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

// Initialize Cognito Identity Provider client for group management
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
    const { email, password, fullName, userType, inviteToken } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate password (Cognito requirements)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    return new Promise((resolve) => {
      const attributeList: CognitoUserAttribute[] = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
      ];

      if (fullName) {
        attributeList.push(new CognitoUserAttribute({ Name: 'name', Value: fullName }));
      }

      // Note: custom:practiceName requires the custom attribute to be defined in Cognito User Pool
      // For now, we'll skip it. You can store practiceName in your database later if needed.
      // To enable this, add a custom attribute "practiceName" (String, Mutable) in your Cognito User Pool
      // if (practiceName) {
      //   attributeList.push(new CognitoUserAttribute({ Name: 'custom:practiceName', Value: practiceName }));
      // }

      userPool.signUp(email, password, attributeList, [], async (err, result) => {
        if (err) {
          console.error('Cognito signup error:', err);
          resolve(
            NextResponse.json(
              { error: err.message || 'Failed to create account' },
              { status: 400 }
            )
          );
          return;
        }

        if (!result) {
          resolve(
            NextResponse.json(
              { error: 'Failed to create account' },
              { status: 500 }
            )
          );
          return;
        }

        // Handle invite token if present
        if (inviteToken) {
          try {
            // Migrate pending subject to active with real Cognito sub
            await migratePendingSubjectToActive(inviteToken, result.userSub);
          } catch (inviteError: any) {
            console.error('Error processing invite token:', inviteError);
            // Continue even if invite processing fails - user can still sign up
          }
        }

        // Add user to appropriate Cognito group
        const groupName = userType === 'member' ? 'Member' : 'Coach';
        try {
          await cognitoClient.send(
            new AdminAddUserToGroupCommand({
              UserPoolId: userPoolId,
              Username: email,
              GroupName: groupName,
            })
          );
        } catch (groupError: any) {
          console.error('Error adding user to group:', groupError);
          // Continue even if group assignment fails - user can be added manually
        }

        // Store userType temporarily - will be used during email verification
        // We'll save to DynamoDB after email verification
        resolve(
          NextResponse.json(
            {
              message: 'Account created successfully. Please check your email to verify your account.',
              userSub: result.userSub,
              userType: userType || 'coach',
            },
            { status: 201 }
          )
        );
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

