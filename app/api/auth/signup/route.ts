import { NextRequest, NextResponse } from 'next/server';
import { CognitoUserPool, CognitoUserAttribute } from 'amazon-cognito-identity-js';
import { saveUserProfile } from '@/lib/dynamodb';

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

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, practiceName } = await req.json();

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

      userPool.signUp(email, password, attributeList, [], (err, result) => {
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

        // Save user profile to DynamoDB
        saveUserProfile({
          userId: result.userSub,
          email,
          fullName: fullName || undefined,
          practiceName: practiceName || undefined,
        })
          .then(() => {
            resolve(
              NextResponse.json(
                {
                  message: 'Account created successfully. Please check your email to verify your account.',
                  userSub: result.userSub,
                },
                { status: 201 }
              )
            );
          })
          .catch((dbError) => {
            // Log the error but don't fail the signup since Cognito user was created
            console.error('Error saving user profile to DynamoDB:', dbError);
            // Still return success since Cognito signup succeeded
            resolve(
              NextResponse.json(
                {
                  message: 'Account created successfully. Please check your email to verify your account.',
                  userSub: result.userSub,
                  warning: 'User profile could not be saved to database. Please contact support.',
                },
                { status: 201 }
              )
            );
          });
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

